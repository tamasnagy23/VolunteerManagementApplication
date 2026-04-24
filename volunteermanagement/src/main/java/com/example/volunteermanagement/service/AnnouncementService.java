package com.example.volunteermanagement.service;

import com.example.volunteermanagement.dto.AnnouncementCommentDTO;
import com.example.volunteermanagement.dto.AnnouncementDTO;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.*;
import com.example.volunteermanagement.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnnouncementService {

    private final AnnouncementRepository announcementRepository;
    private final AnnouncementCommentRepository commentRepository;
    private final AnnouncementReactionRepository reactionRepository;
    private final AnnouncementCommentReactionRepository announcementCommentReactionRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final WorkAreaRepository workAreaRepository;
    private final OrganizationRepository organizationRepository;
    private final EventRepository eventRepository;
    private final ApplicationRepository applicationRepository;
    private final EventTeamMemberRepository eventTeamMemberRepository;
    private final TransactionTemplate transactionTemplate;

    @Autowired
    @Lazy
    private AnnouncementService self;

    private User getMasterUserWithMemberships(String email) {
        return transactionTemplate.execute(status -> {
            User u = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));
            Hibernate.initialize(u.getMemberships());
            u.getMemberships().forEach(m -> Hibernate.initialize(m.getOrganization()));
            return u;
        });
    }

    public List<Map<String, String>> getAllowedPostTargets(String userEmail) {
        User user = getMasterUserWithMemberships(userEmail);
        boolean isSysAdmin = user.getRole() == Role.SYS_ADMIN;
        List<Map<String, String>> targets = new ArrayList<>();

        if (isSysAdmin) {
            targets.add(Map.of("value", "GLOBAL_0", "label", "🌐 Globális Rendszerüzenet (Mindenkinek)"));
        }

        List<Organization> masterLeaderOrgs = isSysAdmin ? organizationRepository.findAll() :
                user.getMemberships().stream()
                        .filter(m -> m.getStatus() == MembershipStatus.APPROVED &&
                                (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER))
                        .map(OrganizationMember::getOrganization).collect(Collectors.toList());

        for (Organization org : masterLeaderOrgs) {
            targets.add(Map.of("value", "ORGANIZATION_" + org.getId(), "label", "🏢 Szervezet: " + org.getName()));
        }

        List<Organization> allActiveOrgs = organizationRepository.findAll().stream()
                .filter(o -> o.getTenantId() != null && !o.getTenantId().trim().isEmpty())
                .collect(Collectors.toList());

        String originalTenant = TenantContext.getCurrentTenant();
        for (Organization org : allActiveOrgs) {
            try {
                TenantContext.setCurrentTenant(org.getTenantId());
                boolean isOrgLeader = masterLeaderOrgs.stream().anyMatch(o -> o.getId().equals(org.getId()));
                targets.addAll(self.collectTenantPostTargets(org, user, isSysAdmin, isOrgLeader));
            } catch (Exception e) {
                System.err.println("Hiba a tenant jogoknál: " + org.getTenantId());
            } finally {
                TenantContext.setCurrentTenant(originalTenant);
            }
        }
        return targets.stream().distinct().collect(Collectors.toList());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public List<Map<String, String>> collectTenantPostTargets(Organization org, User user, boolean isSysAdmin, boolean isOrgLeader) {
        List<Map<String, String>> tenantTargets = new ArrayList<>();

        if (isSysAdmin || isOrgLeader) {
            List<Event> events = eventRepository.findAll();
            for (Event ev : events) {
                if (ev.getTitle() != null) {
                    tenantTargets.add(Map.of("value", "EVENT_" + ev.getId(), "label", "📅 Esemény: " + ev.getTitle() + " (" + org.getName() + ")"));
                    ev.getWorkAreas().forEach(wa ->
                            tenantTargets.add(Map.of("value", "WORK_AREA_" + wa.getId(), "label", "👥 Terület: " + wa.getName() + " (" + ev.getTitle() + ")"))
                    );
                }
            }
        } else {
            List<EventTeamMember> localRoles = eventTeamMemberRepository.findByUserId(user.getId());
            for (EventTeamMember tm : localRoles) {
                Event ev = tm.getEvent();
                if (ev == null || ev.getTitle() == null) continue;

                if (tm.getRole() == EventRole.ORGANIZER || tm.getRole() == EventRole.COORDINATOR) {
                    tenantTargets.add(Map.of("value", "EVENT_" + ev.getId(), "label", "📅 Esemény: " + ev.getTitle()));
                    ev.getWorkAreas().forEach(wa ->
                            tenantTargets.add(Map.of("value", "WORK_AREA_" + wa.getId(), "label", "👥 Terület: " + wa.getName() + " (" + ev.getTitle() + ")"))
                    );
                }
            }
        }
        return tenantTargets;
    }

    public AnnouncementDTO createAnnouncement(String title, String content, String targetType, Long targetId, List<MultipartFile> images, String userEmail) {
        User author = getMasterUserWithMemberships(userEmail);

        List<Map<String, String>> allowedTargets = getAllowedPostTargets(userEmail);
        String targetKey = targetType.equals("GLOBAL") ? "GLOBAL_0" : targetType + "_" + targetId;

        if (allowedTargets.stream().noneMatch(t -> t.get("value").equals(targetKey))) {
            throw new RuntimeException("Nincs jogosultságod ehhez a célközönséghez posztolni!");
        }

        Long orgId = targetType.equals("ORGANIZATION") ? targetId : null;
        Long eventId = targetType.equals("EVENT") ? targetId : null;
        Long workAreaId = targetType.equals("WORK_AREA") ? targetId : null;

        List<String> imageUrls = new ArrayList<>();
        if (images != null && !images.isEmpty()) {
            for (MultipartFile img : images) {
                if (!img.isEmpty()) {
                    imageUrls.add(fileStorageService.storeFile(img, "announcements"));
                }
            }
        }

        Announcement announcement = Announcement.builder()
                .title(title).content(content).imageUrls(imageUrls)
                .authorId(author.getId()).authorName(author.getName()).authorAvatarUrl(author.getProfileImageUrl())
                .organizationId(orgId).eventId(eventId).workAreaId(workAreaId)
                .createdAt(LocalDateTime.now())
                .build();

        return transactionTemplate.execute(status -> {
            Announcement saved = announcementRepository.save(announcement);
            return mapToDTO(saved, author.getId());
        });
    }

    @Transactional
    public AnnouncementDTO updateAnnouncement(Long id, String title, String content, List<String> keptImages, List<MultipartFile> images, String userEmail) {
        Announcement a = announcementRepository.findById(id).orElseThrow();
        User u = userRepository.findByEmail(userEmail).orElseThrow();
        if (!a.getAuthorId().equals(u.getId()) && u.getRole() != Role.SYS_ADMIN) {
            throw new RuntimeException("Nincs jogod szerkeszteni ezt a posztot!");
        }

        a.setTitle(title);
        a.setContent(content);

        List<String> updatedImageUrls = new ArrayList<>();

        if (keptImages != null) {
            updatedImageUrls.addAll(keptImages);
        }

        if (images != null && !images.isEmpty()) {
            for (MultipartFile img : images) {
                if (!img.isEmpty()) {
                    updatedImageUrls.add(fileStorageService.storeFile(img, "announcements"));
                }
            }
        }

        a.setImageUrls(updatedImageUrls);

        return mapToDTO(announcementRepository.save(a), u.getId());
    }

    // =========================================================================
    // SEGÉDMETÓDUS: Gyermek kommentek listáinak kiürítése alulról felfelé
    // =========================================================================
    private void clearRepliesRecursively(AnnouncementComment comment) {
        if (comment.getReplies() != null && !comment.getReplies().isEmpty()) {
            for (AnnouncementComment reply : comment.getReplies()) {
                clearRepliesRecursively(reply);
            }
            comment.getReplies().clear();
        }
    }

    // =========================================================================
    // POSZT TÖRLÉSE - FK VÉDELEMMEL
    // =========================================================================
    @Transactional
    public void deleteAnnouncement(Long id) {
        Announcement a = announcementRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Poszt nem található!"));

        if (a.getComments() != null) {
            for (AnnouncementComment c : a.getComments()) {
                clearRepliesRecursively(c);
            }
            announcementRepository.flush();
        }

        announcementRepository.delete(a);
    }

    public List<AnnouncementDTO> getDashboardFeed(String userEmail) {
        User user = getMasterUserWithMemberships(userEmail);

        if (user.getRole() == Role.SYS_ADMIN) {
            return transactionTemplate.execute(status ->
                    announcementRepository.findAll().stream()
                            .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                            .map(a -> mapToDTO(a, user.getId()))
                            .collect(Collectors.toList())
            );
        }

        Set<Long> orgIds = new HashSet<>();
        Set<Long> eventIds = new HashSet<>();
        Set<Long> areaIds = new HashSet<>();

        user.getMemberships().stream()
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .forEach(m -> orgIds.add(m.getOrganization().getId()));

        String originalTenant = TenantContext.getCurrentTenant();
        for (Organization org : organizationRepository.findAll()) {
            if (org.getTenantId() == null) continue;
            try {
                TenantContext.setCurrentTenant(org.getTenantId());
                Map<String, Set<Long>> tenantContextIds = self.collectVisibleIdsInTenant(user, org.getId());
                eventIds.addAll(tenantContextIds.get("events"));
                areaIds.addAll(tenantContextIds.get("areas"));
                if (!tenantContextIds.get("events").isEmpty()) orgIds.add(org.getId());
            } catch (Exception e) {} finally {
                TenantContext.setCurrentTenant(originalTenant);
            }
        }

        List<Map<String, String>> allowedTargets = getAllowedPostTargets(userEmail);
        for (Map<String, String> target : allowedTargets) {
            String value = target.get("value");
            if (value == null) continue;

            if (value.startsWith("ORGANIZATION_")) {
                orgIds.add(Long.parseLong(value.replace("ORGANIZATION_", "")));
            } else if (value.startsWith("EVENT_")) {
                eventIds.add(Long.parseLong(value.replace("EVENT_", "")));
            } else if (value.startsWith("WORK_AREA_")) {
                areaIds.add(Long.parseLong(value.replace("WORK_AREA_", "")));
            }
        }

        return transactionTemplate.execute(status -> {
            List<Announcement> feed = announcementRepository.findPersonalizedFeed(
                    new ArrayList<>(orgIds.isEmpty() ? List.of(-1L) : orgIds),
                    new ArrayList<>(eventIds.isEmpty() ? List.of(-1L) : eventIds),
                    new ArrayList<>(areaIds.isEmpty() ? List.of(-1L) : areaIds)
            );
            return feed.stream().map(a -> mapToDTO(a, user.getId())).collect(Collectors.toList());
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public Map<String, Set<Long>> collectVisibleIdsInTenant(User user, Long orgId) {
        Set<Long> eIds = new HashSet<>();
        Set<Long> aIds = new HashSet<>();

        applicationRepository.findByUserId(user.getId()).stream()
                .filter(app -> app.getStatus() == ApplicationStatus.APPROVED)
                .forEach(app -> {
                    if (app.getEvent() != null) eIds.add(app.getEvent().getId());
                    if (app.getAssignedWorkArea() != null) aIds.add(app.getAssignedWorkArea().getId());
                });

        eventTeamMemberRepository.findByUserId(user.getId()).forEach(tm -> {
            if (tm.getEvent() != null) {
                eIds.add(tm.getEvent().getId());
                tm.getEvent().getWorkAreas().forEach(wa -> aIds.add(wa.getId()));
            }
        });

        return Map.of("events", eIds, "areas", aIds);
    }

    @Transactional
    public AnnouncementDTO addComment(Long announcementId, String content, String userEmail) {
        Announcement announcement = announcementRepository.findById(announcementId).orElseThrow();
        User user = userRepository.findByEmail(userEmail).orElseThrow();

        AnnouncementComment comment = AnnouncementComment.builder()
                .announcement(announcement).userId(user.getId()).userName(user.getName())
                .userAvatarUrl(user.getProfileImageUrl()).content(content).createdAt(LocalDateTime.now()).build();

        commentRepository.save(comment);
        announcement.getComments().add(comment);
        return mapToDTO(announcement, user.getId());
    }

    @Transactional
    public AnnouncementDTO addReplyToComment(Long announcementId, Long parentId, String content, String userEmail) {
        Announcement a = announcementRepository.findById(announcementId).orElseThrow();
        AnnouncementComment parent = commentRepository.findById(parentId).orElseThrow();
        User u = userRepository.findByEmail(userEmail).orElseThrow();

        AnnouncementComment reply = AnnouncementComment.builder()
                .announcement(a).parentComment(parent).userId(u.getId()).userName(u.getName())
                .userAvatarUrl(u.getProfileImageUrl()).content(content).createdAt(LocalDateTime.now()).build();

        commentRepository.save(reply);
        parent.getReplies().add(reply);
        return mapToDTO(a, u.getId());
    }

    @Transactional
    public AnnouncementDTO updateComment(Long commentId, String content, String userEmail) {
        AnnouncementComment c = commentRepository.findById(commentId).orElseThrow();
        User u = userRepository.findByEmail(userEmail).orElseThrow();
        if (!c.getUserId().equals(u.getId())) throw new RuntimeException("Csak a saját kommentedet szerkesztheted!");

        c.setContent(content);
        commentRepository.save(c);
        return mapToDTO(c.getAnnouncement(), u.getId());
    }

    // =========================================================================
    // KOMMENT TÖRLÉSE - HIBERNATE-BARÁT FK VÉDELEMMEL
    // =========================================================================
    @Transactional
    public AnnouncementDTO deleteComment(Long commentId, String userEmail) {
        AnnouncementComment c = commentRepository.findById(commentId).orElseThrow();
        Announcement a = c.getAnnouncement();
        User u = userRepository.findByEmail(userEmail).orElseThrow();

        if (!c.getUserId().equals(u.getId()) && !a.getAuthorId().equals(u.getId()) && u.getRole() != Role.SYS_ADMIN) {
            throw new RuntimeException("Nincs jogod törölni ezt a kommentet!");
        }

        // 1. Kiürítjük a hozzá tartozó válaszokat, és azonnal szinkronizáljuk az adatbázissal
        clearRepliesRecursively(c);
        announcementRepository.flush();

        // 2. Leválasztjuk a fáról a fő kommentet (az orphanRemoval automatikusan törli majd)
        if (c.getParentComment() == null) {
            a.getComments().remove(c);
        } else {
            c.getParentComment().getReplies().remove(c);
        }

        announcementRepository.save(a);

        return mapToDTO(a, u.getId());
    }

    @Transactional
    public AnnouncementDTO toggleReaction(Long announcementId, String reactionType, String userEmail) {
        Announcement a = announcementRepository.findById(announcementId).orElseThrow();
        User u = userRepository.findByEmail(userEmail).orElseThrow();
        Optional<AnnouncementReaction> ex = reactionRepository.findByAnnouncementIdAndUserId(announcementId, u.getId());

        if (ex.isPresent()) {
            if (ex.get().getReactionType().equals(reactionType)) {
                reactionRepository.delete(ex.get());
                a.getReactions().remove(ex.get());
            } else {
                ex.get().setReactionType(reactionType);
                reactionRepository.save(ex.get());
            }
        } else {
            AnnouncementReaction r = AnnouncementReaction.builder().announcement(a).userId(u.getId()).reactionType(reactionType).build();
            reactionRepository.save(r);
            a.getReactions().add(r);
        }
        return mapToDTO(a, u.getId());
    }

    @Transactional
    public AnnouncementDTO toggleCommentReaction(Long commentId, String type, String email) {
        AnnouncementComment c = commentRepository.findById(commentId).orElseThrow();
        User u = userRepository.findByEmail(email).orElseThrow();
        Optional<AnnouncementCommentReaction> ex = announcementCommentReactionRepository.findByCommentIdAndUserId(commentId, u.getId());

        if (ex.isPresent()) {
            if (ex.get().getReactionType().equals(type)) {
                announcementCommentReactionRepository.delete(ex.get());
                c.getReactions().remove(ex.get());
            } else {
                ex.get().setReactionType(type);
                announcementCommentReactionRepository.save(ex.get());
            }
        } else {
            AnnouncementCommentReaction r = AnnouncementCommentReaction.builder().comment(c).userId(u.getId()).reactionType(type).build();
            announcementCommentReactionRepository.save(r);
            c.getReactions().add(r);
        }
        return mapToDTO(c.getAnnouncement(), u.getId());
    }

    private AnnouncementCommentDTO mapCommentToDTO(AnnouncementComment c, Long currentUserId) {
        List<AnnouncementCommentDTO> replies = c.getReplies().stream()
                .map(r -> mapCommentToDTO(r, currentUserId))
                .collect(Collectors.toList());

        Map<String, Long> rCounts = c.getReactions().stream()
                .collect(Collectors.groupingBy(AnnouncementCommentReaction::getReactionType, Collectors.counting()));

        String curR = c.getReactions().stream()
                .filter(r -> r.getUserId().equals(currentUserId))
                .map(AnnouncementCommentReaction::getReactionType)
                .findFirst().orElse(null);

        Long parentId = c.getParentComment() != null ? c.getParentComment().getId() : null;

        return new AnnouncementCommentDTO(
                c.getId(), c.getUserId(), c.getUserName(), c.getUserAvatarUrl(),
                c.getContent(), c.getCreatedAt(), parentId, replies, rCounts, curR
        );
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public Map<String, String> fetchTargetAndRole(Long eventId, Long workAreaId, Long authorId) {
        String targetName = null;
        String roleName = null;

        if (workAreaId != null) {
            Optional<WorkArea> optWa = workAreaRepository.findById(workAreaId);
            if (optWa.isPresent()) {
                WorkArea wa = optWa.get();
                String eventTitle = wa.getEvent() != null ? wa.getEvent().getTitle() : "Ismeretlen esemény";
                targetName = "👥 Területi üzenet: " + wa.getName() + " (" + eventTitle + ")";

                if (wa.getEvent() != null) {
                    Optional<EventTeamMember> tm = eventTeamMemberRepository.findByUserId(authorId)
                            .stream().filter(t -> t.getEvent().getId().equals(wa.getEvent().getId())).findFirst();
                    if (tm.isPresent()) {
                        if (tm.get().getRole() == EventRole.ORGANIZER) roleName = "Főszervező";
                        else if (tm.get().getRole() == EventRole.COORDINATOR) roleName = "Koordinátor";
                    }
                }
            }
        }
        else if (eventId != null) {
            Optional<Event> optEv = eventRepository.findById(eventId);
            if (optEv.isPresent()) {
                Event ev = optEv.get();
                targetName = "📅 Esemény: " + ev.getTitle();

                Optional<EventTeamMember> tm = eventTeamMemberRepository.findByUserId(authorId)
                        .stream().filter(t -> t.getEvent().getId().equals(ev.getId())).findFirst();
                if (tm.isPresent()) {
                    if (tm.get().getRole() == EventRole.ORGANIZER) roleName = "Főszervező";
                    else if (tm.get().getRole() == EventRole.COORDINATOR) roleName = "Koordinátor";
                }
            }
        }

        if (targetName == null) return null;

        Map<String, String> result = new HashMap<>();
        result.put("targetName", targetName);
        if (roleName != null) {
            result.put("roleName", roleName);
        }
        return result;
    }

    private AnnouncementDTO mapToDTO(Announcement a, Long currentUserId) {
        List<AnnouncementCommentDTO> rootComments = a.getComments().stream()
                .filter(c -> c.getParentComment() == null)
                .map(c -> mapCommentToDTO(c, currentUserId))
                .collect(Collectors.toList());

        Map<String, Long> reactionCounts = a.getReactions().stream()
                .collect(Collectors.groupingBy(AnnouncementReaction::getReactionType, Collectors.counting()));

        String currentUserReaction = a.getReactions().stream()
                .filter(r -> r.getUserId().equals(currentUserId))
                .map(AnnouncementReaction::getReactionType)
                .findFirst().orElse(null);

        String targetName = "🌐 Rendszerüzenet";
        String roleName = "Önkéntes";

        User author = userRepository.findById(a.getAuthorId()).orElse(null);
        if (author != null && author.getRole() == Role.SYS_ADMIN) {
            roleName = "Rendszergazda";
        }

        if (author != null && !roleName.equals("Rendszergazda")) {
            Optional<OrganizationMember> ownerMem = author.getMemberships().stream()
                    .filter(m -> m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER)
                    .max(Comparator.comparing(m -> m.getRole() == OrganizationRole.OWNER ? 2 : 1));

            if (ownerMem.isPresent()) {
                if (ownerMem.get().getRole() == OrganizationRole.OWNER) roleName = "Szervezet Vezető";
                else roleName = "Szervező";
            }
        }

        if (a.getOrganizationId() != null) {
            Organization org = organizationRepository.findById(a.getOrganizationId()).orElse(null);
            targetName = org != null ? "🏢 Szervezet: " + org.getName() : "Szervezeti üzenet";

        } else if (a.getWorkAreaId() != null || a.getEventId() != null) {
            String originalTenant = TenantContext.getCurrentTenant();
            boolean foundInTenant = false;

            for (Organization org : organizationRepository.findAll()) {
                if (org.getTenantId() == null || org.getTenantId().trim().isEmpty()) continue;

                try {
                    TenantContext.setCurrentTenant(org.getTenantId());

                    Map<String, String> details = self.fetchTargetAndRole(a.getEventId(), a.getWorkAreaId(), a.getAuthorId());

                    if (details != null) {
                        targetName = details.get("targetName");

                        if (!roleName.equals("Rendszergazda") && details.containsKey("roleName")) {
                            roleName = details.get("roleName");
                        }
                        foundInTenant = true;
                        break;
                    }
                } catch (Exception e) {
                } finally {
                    TenantContext.setCurrentTenant(originalTenant);
                }
            }

            if (!foundInTenant) {
                targetName = a.getWorkAreaId() != null ? "Területi üzenet" : "Esemény üzenet";
            }
        }

        List<String> loadedImages = a.getImageUrls() != null ? new ArrayList<>(a.getImageUrls()) : new ArrayList<>();

        return new AnnouncementDTO(
                a.getId(),
                a.getTitle(),
                a.getContent(),
                loadedImages,
                a.getAuthorId(),
                a.getAuthorName(),
                a.getAuthorAvatarUrl(),
                targetName,
                a.getOrganizationId(),
                a.getEventId(),
                a.getWorkAreaId(),
                a.getCreatedAt(),
                rootComments,
                reactionCounts,
                currentUserReaction,
                roleName
        );
    }
}