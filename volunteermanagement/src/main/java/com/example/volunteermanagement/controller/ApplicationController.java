package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.ApplicationSubmitDTO;
import com.example.volunteermanagement.dto.BulkEmailRequest;
import com.example.volunteermanagement.dto.PendingApplicationDTO;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.*;
import com.example.volunteermanagement.service.AuditLogService;
import com.example.volunteermanagement.service.EmailService;
import com.example.volunteermanagement.service.TenantProvisioningService;
import com.example.volunteermanagement.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.hibernate.Hibernate;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.MediaType;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/applications")
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final EventRepository eventRepository;
    private final WorkAreaRepository workAreaRepository;
    private final EmailService emailService;
    private final AuditLogService auditLogService;
    private final TenantProvisioningService tenantProvisioningService;
    private final OrganizationMemberRepository organizationMemberRepository;
    private final OrganizationRepository organizationRepository;
    private final TransactionTemplate transactionTemplate;
    private final EventTeamMemberRepository eventTeamMemberRepository;

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public ResponseEntity<?> applyForEvent(@RequestBody ApplicationSubmitDTO request, Principal principal) {
        User user = userRepository.findByEmail(principal.getName()).orElseThrow();
        Event event = eventRepository.findById(request.eventId()).orElseThrow();

        List<WorkArea> preferredAreas = workAreaRepository.findAllById(request.preferredWorkAreaIds());
        if (preferredAreas.isEmpty()) return ResponseEntity.badRequest().body("Legalább egy munkaterületet ki kell választanod!");

        List<Application> applicationsToSave = new ArrayList<>();
        for (WorkArea wa : preferredAreas) {
            boolean alreadyApplied = applicationRepository.findByUserIdAndEventId(user.getId(), event.getId()).stream()
                    .anyMatch(app -> app.getAssignedWorkArea() != null && app.getAssignedWorkArea().getId().equals(wa.getId()));

            if (alreadyApplied) continue;

            Application application = Application.builder().userId(user.getId()).event(event).assignedWorkArea(wa).preferredWorkAreas(List.of(wa))
                    .status(ApplicationStatus.PENDING).appliedAt(LocalDateTime.now()).build();

            if (request.answers() != null && !request.answers().isEmpty()) {
                List<ApplicationAnswer> answersList = new ArrayList<>();
                for (EventQuestion q : event.getQuestions()) {
                    if (request.answers().containsKey(q.getId())) {
                        answersList.add(ApplicationAnswer.builder().application(application).question(q).answerText(request.answers().get(q.getId())).build());
                    }
                }
                application.setAnswers(answersList);
            }
            applicationsToSave.add(application);
        }

        if (applicationsToSave.isEmpty()) return ResponseEntity.badRequest().body("Ezekre a területekre már jelentkeztél!");

        applicationRepository.saveAll(applicationsToSave);
        auditLogService.logAction(principal.getName(), "EVENT_APPLICATION", "Esemény ID: " + event.getId(), "Sikeresen jelentkezett " + applicationsToSave.size() + " munkaterületre.", event.getOrganization().getId());
        return ResponseEntity.ok("Sikeres jelentkezés!");
    }

    @GetMapping("/my")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<PendingApplicationDTO>> getMyApplications(Principal principal) {
        User user = transactionTemplate.execute(status -> {
            User u = userRepository.findByEmail(principal.getName()).orElseThrow();
            Hibernate.initialize(u.getMemberships());
            u.getMemberships().forEach(m -> Hibernate.initialize(m.getOrganization()));
            return u;
        });

        List<PendingApplicationDTO> myApplications = new ArrayList<>();
        List<Organization> allOrganizations = organizationRepository.findAll().stream()
                .filter(org -> org.getTenantId() != null && !org.getTenantId().trim().isEmpty())
                .collect(Collectors.toList());

        String originalTenant = TenantContext.getCurrentTenant();

        try {
            for (Organization org : allOrganizations) {
                TenantContext.setCurrentTenant(org.getTenantId());

                List<PendingApplicationDTO> tenantDtos = transactionTemplate.execute(status -> {
                    List<Application> apps = applicationRepository.findByUserId(user.getId());

                    List<EventTeamMember> myTeamRolesInTenant = eventTeamMemberRepository.findByUserId(user.getId());
                    Map<Long, String> eventRoleMap = new java.util.HashMap<>();
                    for (EventTeamMember tm : myTeamRolesInTenant) {
                        if (tm.getEvent() != null) {
                            String roleStr = tm.getRole() == EventRole.ORGANIZER ? "Főszervező" : (tm.getRole() == EventRole.COORDINATOR ? "Koordinátor" : "Önkéntes");
                            eventRoleMap.put(tm.getEvent().getId(), roleStr);
                        }
                    }

                    List<PendingApplicationDTO> dtos = new ArrayList<>();
                    for (Application app : apps) {
                        Long evId = app.getEvent() != null ? app.getEvent().getId() : -1L;
                        String role = eventRoleMap.getOrDefault(evId, "Önkéntes");

                        // LÁGY SZŰRÉS: Ha Főszervező vagy Koordinátor, eltüntetjük a "Saját jelentkezések" listából is, hiszen ő már a vezetőség része!
                        if (!role.equals("Főszervező") && !role.equals("Koordinátor")) {
                            dtos.add(mapToDTO(app, user, org, role));
                        }
                    }

                    return dtos;
                });

                if (tenantDtos != null) {
                    myApplications.addAll(tenantDtos);
                }
            }
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }

        myApplications.sort((a, b) -> b.id().compareTo(a.id()));
        return ResponseEntity.ok(myApplications);
    }

    @GetMapping("/event/{eventId}")
    @PreAuthorize("@eventSecurity.hasPermission(authentication.name, #eventId, 'MANAGE_APPLICATIONS')")
    public ResponseEntity<?> getApplicationsByEvent(
            @PathVariable("eventId") Long eventId,
            @RequestParam(value = "status", required = false) ApplicationStatus status) {

        Map<Long, String> eventRoleMap = new java.util.HashMap<>();

        // 1. Jelentkezések és Csapatszerepek lekérése a HELYI (Tenant) adatbázisból!
        List<Application> applications = transactionTemplate.execute(s -> {
            List<Application> apps = applicationRepository.findByEventId(eventId);
            if (status != null) {
                apps = apps.stream().filter(app -> app.getStatus() == status).collect(Collectors.toList());
            }

            for (Application app : apps) {
                Hibernate.initialize(app.getEvent());
                if (app.getEvent() != null) Hibernate.initialize(app.getEvent().getOrganization());
                Hibernate.initialize(app.getAssignedWorkArea());
                Hibernate.initialize(app.getPreferredWorkAreas());
                Hibernate.initialize(app.getAnswers());
                if (app.getAnswers() != null) app.getAnswers().forEach(ans -> Hibernate.initialize(ans.getQuestion()));
            }

            // A szerepköröket is ITT töltjük be, amíg még jó adatbázisban vagyunk!
            List<EventTeamMember> teamMembers = eventTeamMemberRepository.findByEventId(eventId);
            for (EventTeamMember tm : teamMembers) {
                String roleStr = tm.getRole() == EventRole.ORGANIZER ? "Főszervező" : (tm.getRole() == EventRole.COORDINATOR ? "Koordinátor" : "Önkéntes");
                eventRoleMap.put(tm.getUserId(), roleStr);
            }

            return apps;
        });

        if (applications == null || applications.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        // =========================================================================
        // LÁGY SZŰRÉS: Ha valaki Főszervező vagy Koordinátor, kiszűrjük a listából!
        // =========================================================================
        List<Application> filteredApplications = applications.stream()
                .filter(app -> {
                    String role = eventRoleMap.getOrDefault(app.getUserId(), "Önkéntes");
                    // Ha a jelentkezés APPROVED, és az illető Vezető lett, ELREJTJÜK!
                    if (status == ApplicationStatus.APPROVED && (role.equals("Főszervező") || role.equals("Koordinátor"))) {
                        return false;
                    }
                    return true;
                })
                .collect(Collectors.toList());

        List<Long> userIds = filteredApplications.stream().map(Application::getUserId).distinct().collect(Collectors.toList());

        if (userIds.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        String currentTenant = TenantContext.getCurrentTenant();
        Map<Long, User> masterUsersMap = new java.util.HashMap<>();

        // 2. Felhasználók lekérése a MASTER adatbázisból
        try {
            TenantContext.setCurrentTenant(null);
            transactionTemplate.execute(s -> {
                List<User> users = userRepository.findAllById(userIds);
                for (User u : users) {
                    Hibernate.initialize(u.getMemberships());
                    u.getMemberships().forEach(m -> Hibernate.initialize(m.getOrganization()));
                    masterUsersMap.put(u.getId(), u);
                }
                return null;
            });
        } finally {
            TenantContext.setCurrentTenant(currentTenant);
        }

        // 3. DTO generálás a kombinált adatokból (Már csak a szűrt listából)
        List<PendingApplicationDTO> result = filteredApplications.stream().map(app -> {
            User masterUser = masterUsersMap.get(app.getUserId());
            Organization org = app.getEvent() != null ? app.getEvent().getOrganization() : null;
            String role = eventRoleMap.getOrDefault(app.getUserId(), "Önkéntes");
            return mapToDTO(app, masterUser, org, role);
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @PutMapping("/{applicationId}/status")
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public ResponseEntity<?> updateApplicationStatus(
            @PathVariable("applicationId") Long applicationId,
            @RequestParam("status") ApplicationStatus status,
            @RequestParam(value = "rejectionMessage", required = false) String rejectionMessage,
            Principal principal) {

        User user = userRepository.findByEmail(principal.getName()).orElseThrow();
        Application application = applicationRepository.findById(applicationId).orElseThrow();
        Event event = application.getEvent();

        boolean isOwner = application.getUserId().equals(user.getId());

        boolean isAdmin = user.getRole().name().equals("SYS_ADMIN") ||
                user.getMemberships().stream().anyMatch(m -> m.getOrganization().getId().equals(event.getOrganization().getId()) && (m.getRole() == OrganizationRole.ORGANIZER || m.getRole() == OrganizationRole.OWNER));

        if (isOwner && !isAdmin) {
            if (status == ApplicationStatus.PENDING) {
                application.setStatus(status); application.setRejectionMessage(null);
                applicationRepository.save(application);
                auditLogService.logAction(principal.getName(), "APPLICATION_RESUBMIT", "Jelentkezés ID: " + applicationId, "A felhasználó újra benyújtotta a visszavont jelentkezését.", event.getOrganization().getId());
                return ResponseEntity.ok("Sikeres visszajelentkezés!");
            }
            return ResponseEntity.status(403).body("Nincs jogod ehhez a művelethez!");
        }

        if (isAdmin) {
            application.setStatus(status);
            if (status == ApplicationStatus.REJECTED) {
                application.setRejectionMessage(rejectionMessage);
            }
            else if (status == ApplicationStatus.APPROVED) {
                application.setRejectionMessage(null);

                User applicant = userRepository.findById(application.getUserId()).orElseThrow();
                Organization org = event.getOrganization();

                OrganizationMember membership = organizationMemberRepository.findByOrganizationAndUser(org, applicant).orElse(null);

                if (membership == null) {
                    membership = new OrganizationMember();
                    membership.setUser(applicant);
                    membership.setOrganization(org);
                    membership.setRole(OrganizationRole.VOLUNTEER);
                    membership.setStatus(MembershipStatus.APPROVED);
                    membership.setJoinedAt(LocalDateTime.now());
                    organizationMemberRepository.save(membership);
                }
                else if (membership.getStatus() != MembershipStatus.APPROVED) {
                    membership.setStatus(MembershipStatus.APPROVED);
                    organizationMemberRepository.save(membership);
                }

                if (org.getTenantId() != null) {
                    String dbName = org.getTenantId() + "_db";
                    tenantProvisioningService.syncUserToTenantDatabase(dbName, applicant, org, membership);
                }
            }

            applicationRepository.save(application);
            auditLogService.logAction(principal.getName(), "UPDATE_APP_STATUS", "Jelentkezés ID: " + applicationId, "Új státusz: " + status.name(), event.getOrganization().getId());
            return ResponseEntity.ok("Státusz frissítve.");
        }
        return ResponseEntity.status(403).body("Nincs jogosultságod a státusz módosításához!");
    }

    @PutMapping("/bulk-status")
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public ResponseEntity<?> updateBulkApplicationStatus(
            @RequestBody List<Long> applicationIds,
            @RequestParam("status") ApplicationStatus status,
            Principal principal) {

        User admin = userRepository.findByEmail(principal.getName()).orElseThrow();
        boolean isGlobalAdmin = admin.getRole().name().equals("SYS_ADMIN");
        List<Application> applications = applicationRepository.findAllById(applicationIds);
        int modifiedCount = 0;
        Long firstOrgId = null;

        for (Application app : applications) {
            Organization org = app.getEvent().getOrganization();
            boolean isOrgAdmin = admin.getMemberships().stream().anyMatch(m -> m.getOrganization().getId().equals(org.getId()) && (m.getRole() == OrganizationRole.ORGANIZER || m.getRole() == OrganizationRole.OWNER));

            if (isGlobalAdmin || isOrgAdmin) {
                app.setStatus(status);

                if (status == ApplicationStatus.APPROVED) {
                    User applicant = userRepository.findById(app.getUserId()).orElse(null);
                    if (applicant != null && org != null) {
                        OrganizationMember membership = organizationMemberRepository.findByOrganizationAndUser(org, applicant).orElse(null);

                        if (membership == null) {
                            membership = new OrganizationMember();
                            membership.setUser(applicant);
                            membership.setOrganization(org);
                            membership.setRole(OrganizationRole.VOLUNTEER);
                            membership.setStatus(MembershipStatus.APPROVED);
                            membership.setJoinedAt(LocalDateTime.now());
                            organizationMemberRepository.save(membership);
                        } else if (membership.getStatus() != MembershipStatus.APPROVED) {
                            membership.setStatus(MembershipStatus.APPROVED);
                            organizationMemberRepository.save(membership);
                        }

                        if (org.getTenantId() != null) {
                            String dbName = org.getTenantId() + "_db";
                            tenantProvisioningService.syncUserToTenantDatabase(dbName, applicant, org, membership);
                        }
                    }
                }

                modifiedCount++;
                if (firstOrgId == null) firstOrgId = org.getId();
            }
        }
        applicationRepository.saveAll(applications);
        auditLogService.logAction(principal.getName(), "BULK_UPDATE_STATUS", "Érintett jelentkezések: " + modifiedCount + " db", "Tömeges módosítás új státuszra: " + status.name(), firstOrgId);
        return ResponseEntity.ok("Tömeges módosítás sikeres!");
    }

    @DeleteMapping("/{applicationId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> withdrawApplication(
            @PathVariable("applicationId") Long applicationId,
            @RequestParam(value = "reason", required = false) String reason,
            Principal principal) {

        User user = userRepository.findByEmail(principal.getName()).orElseThrow();

        List<Organization> allOrganizations = organizationRepository.findAll().stream()
                .filter(org -> org.getTenantId() != null && !org.getTenantId().trim().isEmpty())
                .collect(Collectors.toList());

        String originalTenant = TenantContext.getCurrentTenant();
        boolean success = false;

        try {
            for (Organization org : allOrganizations) {
                TenantContext.setCurrentTenant(org.getTenantId());

                Boolean foundAndUpdated = transactionTemplate.execute(status -> {
                    java.util.Optional<Application> appOpt = applicationRepository.findById(applicationId);

                    if (appOpt.isPresent()) {
                        Application app = appOpt.get();

                        if (!app.getUserId().equals(user.getId())) {
                            return false;
                        }

                        app.setStatus(ApplicationStatus.WITHDRAWN);
                        app.setWithdrawalReason(reason);
                        applicationRepository.save(app);

                        auditLogService.logAction(user.getEmail(), "WITHDRAW_APPLICATION",
                                "ID: " + applicationId, "Indok: " + reason, org.getId());

                        return true;
                    }
                    return null;
                });

                if (foundAndUpdated != null) {
                    if (!foundAndUpdated) {
                        return ResponseEntity.status(403).body("Csak a saját jelentkezésedet vonhatod vissza!");
                    }
                    success = true;
                    break;
                }
            }
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }

        if (success) {
            return ResponseEntity.ok("Jelentkezés sikeresen visszavonva.");
        } else {
            return ResponseEntity.status(404).body("A jelentkezés nem található egyik szervezetnél sem.");
        }
    }

    @PutMapping("/{applicationId}/note")
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public ResponseEntity<?> updateAdminNote(@PathVariable("applicationId") Long applicationId, @RequestBody java.util.Map<String, String> payload, Principal principal) {
        User admin = userRepository.findByEmail(principal.getName()).orElseThrow();
        Application application = applicationRepository.findById(applicationId).orElseThrow();
        Event event = application.getEvent();

        boolean isGlobalAdmin = admin.getRole().name().equals("SYS_ADMIN");
        boolean isOrgAdmin = admin.getMemberships().stream().anyMatch(m -> m.getOrganization().getId().equals(event.getOrganization().getId()) && (m.getRole() == OrganizationRole.ORGANIZER || m.getRole() == OrganizationRole.OWNER));

        if (!isGlobalAdmin && !isOrgAdmin) return ResponseEntity.status(403).body("Nincs jogosultságod megjegyzést írni!");

        application.setAdminNote(payload.get("note"));
        applicationRepository.saveAndFlush(application);
        return ResponseEntity.ok("Megjegyzés sikeresen elmentve.");
    }

    @PostMapping(value = "/bulk-email", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public ResponseEntity<?> sendBulkEmail(
            @RequestParam("subject") String subject,
            @RequestParam("message") String message,
            @RequestParam("applicationIds") List<Long> applicationIds,
            @RequestParam(value = "attachments", required = false) List<MultipartFile> attachments,
            Principal principal) throws java.io.IOException {

        User admin = userRepository.findByEmail(principal.getName()).orElseThrow();
        boolean isGlobalAdmin = admin.getRole().name().equals("SYS_ADMIN");
        List<Application> applications = applicationRepository.findAllById(applicationIds);
        List<String> bccEmails = new ArrayList<>();

        String orgName = "Értesítés";
        String orgEmail = null;

        for (Application app : applications) {
            boolean isOrgAdmin = admin.getMemberships().stream().anyMatch(m ->
                    m.getOrganization().getId().equals(app.getEvent().getOrganization().getId()) &&
                            (m.getRole() == OrganizationRole.ORGANIZER || m.getRole() == OrganizationRole.OWNER));

            if (isGlobalAdmin || isOrgAdmin) {
                User applicant = userRepository.findById(app.getUserId()).orElse(null);
                if (applicant != null) bccEmails.add(applicant.getEmail());

                if (orgEmail == null && app.getEvent() != null && app.getEvent().getOrganization() != null) {
                    orgName = app.getEvent().getOrganization().getName();
                    orgEmail = app.getEvent().getOrganization().getEmail();
                }
            }
        }

        java.util.Map<String, byte[]> attachmentMap = new java.util.HashMap<>();
        if (attachments != null) {
            for (MultipartFile file : attachments) {
                if (!file.isEmpty() && file.getOriginalFilename() != null) {
                    attachmentMap.put(file.getOriginalFilename(), file.getBytes());
                }
            }
        }

        if (!bccEmails.isEmpty()) {
            emailService.sendBulkEmailBcc(bccEmails, subject, message, orgName, orgEmail, attachmentMap);
        }

        return ResponseEntity.ok(Map.of("message", "E-mailek elküldve " + bccEmails.size() + " címzettnek!"));
    }

    private PendingApplicationDTO mapToDTO(Application app, User appUser, Organization org, String eventRole) {
        String eventOrgName = org != null ? org.getName() : "Ismeretlen szervezet";
        Long eventOrgId = org != null ? org.getId() : null;
        Long eventId = app.getEvent() != null ? app.getEvent().getId() : null;
        String eventTitle = app.getEvent() != null ? app.getEvent().getTitle() : "Ismeretlen esemény";
        String displayAreaName = "Nincs terület megadva";
        Long displayAreaId = null;

        if (app.getAssignedWorkArea() != null) {
            displayAreaId = app.getAssignedWorkArea().getId();
            displayAreaName = app.getAssignedWorkArea().getName();
        } else if (app.getPreferredWorkAreas() != null && !app.getPreferredWorkAreas().isEmpty()) {
            displayAreaName = app.getPreferredWorkAreas().stream().map(WorkArea::getName).collect(Collectors.joining(", "));
            displayAreaId = app.getPreferredWorkAreas().get(0).getId();
        }

        java.util.Map<String, String> answersMap = new java.util.HashMap<>();
        if (app.getAnswers() != null) {
            for (ApplicationAnswer answer : app.getAnswers()) {
                answersMap.put(answer.getQuestion().getQuestionText(), answer.getAnswerText());
            }
        }

        String appliedAtStr = app.getAppliedAt() != null
                ? app.getAppliedAt().format(java.time.format.DateTimeFormatter.ofPattern("yyyy. MM. dd. HH:mm"))
                : "-";

        String safePhoneNumber = appUser != null ? appUser.getPhoneNumber() : "Nincs telefon";
        if (app.getStatus() == ApplicationStatus.REJECTED || app.getStatus() == ApplicationStatus.WITHDRAWN) {
            safePhoneNumber = "Rejtett adat (GDPR)";
        }

        String userAvatar = appUser != null ? appUser.getProfileImageUrl() : null;

        return new PendingApplicationDTO(
                app.getId(), appUser != null ? appUser.getName() : "Névtelen",
                appUser != null ? appUser.getEmail() : "Nincs email", safePhoneNumber,
                eventOrgName, eventOrgId, displayAreaId, displayAreaName,
                app.getStatus().name(), eventId, eventTitle, answersMap,
                userAvatar,
                appliedAtStr,
                eventRole,
                app.getAdminNote(),
                app.getRejectionMessage(), app.getWithdrawalReason()
        );
    }
}