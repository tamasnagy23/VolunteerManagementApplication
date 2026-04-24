package com.example.volunteermanagement.service;

import com.example.volunteermanagement.config.DataSourceConfig;
import com.example.volunteermanagement.dto.OrgMembershipDTO;
import com.example.volunteermanagement.dto.TeamMemberDTO;
import com.example.volunteermanagement.dto.UserDTO;
import com.example.volunteermanagement.dto.UserStatsDTO;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.ApplicationRepository;
import com.example.volunteermanagement.repository.OrganizationRepository;
import com.example.volunteermanagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final ApplicationRepository applicationRepository;
    private final EmailService emailService;
    private final OrganizationRepository organizationRepository;
    private final DataSourceConfig dataSourceConfig;

    @Transactional(readOnly = true)
    public List<TeamMemberDTO> getTeamMembers(String requesterEmail, Long orgId) {
        User requester = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));

        List<User> targetUsers;

        if (requester.getRole() == Role.SYS_ADMIN) {
            if (orgId != null) {
                targetUsers = userRepository.findUsersByOrganizationIds(List.of(orgId));

                // Rendszergazda manuális hozzáadása a listához, ha nincs benne
                boolean iAmAlreadyIn = targetUsers.stream().anyMatch(u -> u.getId().equals(requester.getId()));
                if (!iAmAlreadyIn) {
                    targetUsers = new java.util.ArrayList<>(targetUsers);
                    targetUsers.add(requester);
                }
            } else {
                targetUsers = userRepository.findAll();
            }
        } else {
            List<Long> myManagedOrgIds = requester.getMemberships().stream()
                    .filter(m -> m.getStatus() == MembershipStatus.APPROVED &&
                            (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER))
                    .map(m -> m.getOrganization().getId())
                    .collect(Collectors.toList());

            if (myManagedOrgIds.isEmpty()) {
                throw new RuntimeException("Nincs jogosultságod a csapat megtekintéséhez.");
            }

            if (orgId != null && myManagedOrgIds.contains(orgId)) {
                targetUsers = userRepository.findUsersByOrganizationIds(List.of(orgId));
            } else {
                targetUsers = userRepository.findUsersByOrganizationIds(myManagedOrgIds);
            }
        }

        java.util.Map<Long, java.util.Map<String, String>> masterDataMap = new java.util.HashMap<>();
        if (!targetUsers.isEmpty()) {
            List<Long> userIds = targetUsers.stream().map(User::getId).collect(Collectors.toList());
            String placeholders = String.join(",", java.util.Collections.nCopies(userIds.size(), "?"));
            String sql = "SELECT id, phone_number, profile_image_url FROM users WHERE id IN (" + placeholders + ")";

            try (java.sql.Connection conn = dataSourceConfig.getMasterDataSource().getConnection();
                 java.sql.PreparedStatement ps = conn.prepareStatement(sql)) {

                int index = 1;
                for (Long id : userIds) {
                    ps.setLong(index++, id);
                }

                try (java.sql.ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        java.util.Map<String, String> data = new java.util.HashMap<>();
                        data.put("phone", rs.getString("phone_number"));
                        data.put("image", rs.getString("profile_image_url"));
                        masterDataMap.put(rs.getLong("id"), data);
                    }
                }
            } catch (Exception e) {
                log.error("Hiba a Mester adatbázis olvasásakor: ", e);
            }
        }

        return targetUsers.stream().map(user -> {
                    java.util.Map<Long, OrgMembershipDTO> uniqueOrgs = new java.util.HashMap<>();

                    user.getMemberships().stream()
                            .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                            .forEach(m -> {
                                uniqueOrgs.putIfAbsent(m.getOrganization().getId(), new OrgMembershipDTO(
                                        m.getOrganization().getId(),
                                        m.getOrganization().getName(),
                                        m.getRole().name(),
                                        m.getOrganization().getTenantId(),
                                        m.getStatus().name(),
                                        m.getRejectionMessage()
                                ));
                            });

                    List<OrgMembershipDTO> orgDTOs = new java.util.ArrayList<>(uniqueOrgs.values());

                    if (orgDTOs.isEmpty() && user.getRole() != Role.SYS_ADMIN) {
                        return null;
                    }

                    java.util.Map<String, String> masterData = masterDataMap.getOrDefault(user.getId(), new java.util.HashMap<>());
                    String realPhone = masterData.get("phone") != null ? masterData.get("phone") : user.getPhoneNumber();
                    String realImage = masterData.get("image") != null ? masterData.get("image") : user.getProfileImageUrl();

                    return new TeamMemberDTO(
                            user.getId(),
                            user.getName(),
                            user.getEmail(),
                            user.getRole().name(),
                            realPhone,
                            realImage,
                            orgDTOs
                    );
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    @Transactional
    public void updateOrganizationRole(Long userId, Long orgId, String newRoleStr, String requesterEmail) {
        User requester = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new RuntimeException("Hiba a hitelesítésnél"));

        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("A célfelhasználó nem található"));

        OrganizationRole newRole;
        try {
            newRole = OrganizationRole.valueOf(newRoleStr);
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Érvénytelen szervezeti szerepkör");
        }

        var targetMembership = targetUser.getMemberships().stream()
                .filter(m -> m.getOrganization().getId().equals(orgId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("A felhasználó nem tagja ennek a szervezetnek."));

        boolean isSysAdmin = requester.getRole() == Role.SYS_ADMIN;
        boolean isRequesterLeaderHere = requester.getMemberships().stream()
                .anyMatch(m -> m.getOrganization().getId().equals(orgId) &&
                        (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER));

        if (!isSysAdmin && !isRequesterLeaderHere) {
            throw new RuntimeException("Nincs jogosultságod ebben a szervezetben módosítani!");
        }

        if ((targetMembership.getRole() == OrganizationRole.OWNER || targetMembership.getRole() == OrganizationRole.ORGANIZER) &&
                (newRole != OrganizationRole.OWNER && newRole != OrganizationRole.ORGANIZER)) {

            long leaderCount = targetMembership.getOrganization().getMembers().stream()
                    .filter(m -> m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER)
                    .count();

            if (leaderCount <= 1) {
                throw new RuntimeException("Nem fokozhatod le a szervezet utolsó vezetőjét!");
            }
        }

        OrganizationRole oldRole = targetMembership.getRole();
        targetMembership.setRole(newRole);

        auditLogService.logAction(
                requesterEmail,
                "ORG_ROLE_UPDATE",
                "Célpont: " + targetUser.getEmail(),
                "Szerepkör módosítva: " + oldRole + " -> " + newRole,
                orgId
        );
    }

    @Transactional
    public void removeMemberFromOrganization(Long userId, Long orgId, String requesterEmail) {
        User requester = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new RuntimeException("Hiba a hitelesítésnél"));
        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("A célfelhasználó nem található"));

        var targetMembership = targetUser.getMemberships().stream()
                .filter(m -> m.getOrganization().getId().equals(orgId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("A felhasználó nem tagja ennek a szervezetnek."));

        boolean isSysAdmin = requester.getRole() == Role.SYS_ADMIN;
        boolean isRequesterLeaderHere = requester.getMemberships().stream()
                .anyMatch(m -> m.getOrganization().getId().equals(orgId) &&
                        (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER));

        if (!isSysAdmin && !isRequesterLeaderHere) {
            throw new RuntimeException("Nincs jogosultságod eltávolítani ezt a tagot!");
        }

        if (targetMembership.getRole() == OrganizationRole.OWNER) {
            throw new RuntimeException("A szervezet alapítóját (OWNER) nem lehet eltávolítani!");
        }

        if (targetMembership.getRole() == OrganizationRole.ORGANIZER) {
            long leaderCount = targetMembership.getOrganization().getMembers().stream()
                    .filter(m -> m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER)
                    .count();
            if (leaderCount <= 1) {
                throw new RuntimeException("Nem távolíthatod el a szervezet utolsó vezetőjét!");
            }
        }

        targetUser.getMemberships().remove(targetMembership);
        userRepository.save(targetUser);

        auditLogService.logAction(
                requesterEmail,
                "REMOVE_MEMBER",
                "Eltávolított felhasználó: " + targetUser.getEmail(),
                "A szervező eltávolította a tagot a csapatból.",
                orgId
        );
    }

    @Transactional(readOnly = true)
    public UserDTO getCurrentUserProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));

        List<OrgMembershipDTO> memberships = user.getMemberships().stream()
                .map(m -> new OrgMembershipDTO(
                        m.getOrganization().getId(),
                        m.getOrganization().getName(),
                        m.getRole().name(),
                        m.getOrganization().getTenantId(),
                        m.getStatus().name(),
                        m.getRejectionMessage()
                ))
                .collect(Collectors.toList());

        int activeOrgs = (int) user.getMemberships().stream()
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .count();

        List<Application> completedApps = applicationRepository.findCompletedApplicationsByUser(user.getId());

        int completedEvents = (int) completedApps.stream()
                .map(a -> a.getEvent().getId())
                .distinct()
                .count();

        int totalHours = completedApps.stream()
                .mapToInt(a -> {
                    if (a.getEvent().getStartTime() == null || a.getEvent().getEndTime() == null) {
                        return 0;
                    }
                    java.time.Duration duration = java.time.Duration.between(
                            a.getEvent().getStartTime(),
                            a.getEvent().getEndTime()
                    );
                    return (int) duration.toHours();
                })
                .sum();

        UserStatsDTO stats = new UserStatsDTO(totalHours, completedEvents, activeOrgs);

        return new UserDTO(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                user.getPhoneNumber(),
                user.getProfileImageUrl(),
                memberships,
                stats
        );
    }

    @Transactional
    public void anonymizeMyAccount(String currentEmail, PasswordEncoder passwordEncoder) {
        User user = userRepository.findByEmail(currentEmail)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));

        boolean isSoleOwner = user.getMemberships().stream()
                .anyMatch(m -> m.getRole() == OrganizationRole.OWNER);

        if (isSoleOwner) {
            throw new RuntimeException("Alapítóként nem törölheted a fiókod! Kérlek, előbb ruházd át a vezetést a csapatkezelőben.");
        }

        user.setName("Törölt Felhasználó");
        user.setPhoneNumber(null);

        String randomId = UUID.randomUUID().toString().substring(0, 8);
        user.setEmail("deleted_user_" + randomId + "@anonymized.local");
        user.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));

        userRepository.save(user);

        auditLogService.logAction(
                currentEmail,
                "ACCOUNT_DELETED",
                "Saját fiók",
                "A felhasználó élt a GDPR törlési jogával, a fiók anonimizálva lett.",
                null
        );

        log.warn("AUDIT GDPR: Fiók véglegesen törölve és anonimizálva! Eredeti (most már törölt) email: {}", currentEmail);
    }

    @Transactional(readOnly = true)
    public void sendTeamEmail(List<Long> userIds, String subject, String message, Long orgId, String adminEmail, List<org.springframework.web.multipart.MultipartFile> attachments) {
        User admin = userRepository.findByEmail(adminEmail).orElseThrow();
        List<User> targetUsers = userRepository.findAllById(userIds);
        List<String> bccEmails = targetUsers.stream().map(User::getEmail).collect(Collectors.toList());

        String orgName = "Rendszer Értesítés";
        String orgEmail = null;

        if (orgId == null && !targetUsers.isEmpty()) {
            Organization org = targetUsers.get(0).getMemberships().stream()
                    .map(OrganizationMember::getOrganization)
                    .findFirst().orElse(null);
            if (org != null) {
                orgId = org.getId();
            }
        }
        Long orgIdForLog = orgId;

        if (orgId != null) {
            Organization org = organizationRepository.findById(orgId).orElse(null);
            if (org != null) {
                orgName = org.getName();
                orgEmail = org.getEmail();
                System.out.println("🔧 DEBUG: Szervezet kikeresve orgId (" + orgId + ") alapján: Név=" + orgName + ", Email=" + orgEmail);
            }
        }
        else {
            for (OrganizationMember m : admin.getMemberships()) {
                if (m.getStatus() == MembershipStatus.APPROVED &&
                        (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER)) {
                    orgName = m.getOrganization().getName();
                    orgEmail = m.getOrganization().getEmail();
                    orgIdForLog = m.getOrganization().getId();
                    System.out.println("🔧 DEBUG: Szervezet kikeresve tagság alapján: Név=" + orgName + ", Email=" + orgEmail);
                    break;
                }
            }
        }

        if (orgEmail == null || orgEmail.trim().isEmpty()) {
            System.out.println("⚠️ KRITIKUS DEBUG: Még mindig NULL az orgEmail! Kérlek ellenőrizd, hogy az adatbázisban a(z) " + orgName + " szervezetnek ki van-e töltve az email címe!");
        }

        java.util.Map<String, byte[]> attachmentMap = new java.util.HashMap<>();
        if (attachments != null) {
            for (org.springframework.web.multipart.MultipartFile file : attachments) {
                if (!file.isEmpty() && file.getOriginalFilename() != null) {
                    try {
                        attachmentMap.put(file.getOriginalFilename(), file.getBytes());
                    } catch (java.io.IOException e) {
                        throw new RuntimeException("Hiba a fájl beolvasásakor: " + e.getMessage());
                    }
                }
            }
        }

        if (!bccEmails.isEmpty()) {
            emailService.sendBulkEmailBcc(bccEmails, subject, message, orgName, orgEmail, attachmentMap);
            auditLogService.logAction(adminEmail, "TEAM_BULK_EMAIL", "Címzettek száma: " + bccEmails.size(), "Tárgy: " + subject, orgIdForLog);
        }
    }
}