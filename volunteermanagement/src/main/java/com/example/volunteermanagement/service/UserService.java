package com.example.volunteermanagement.service;

import com.example.volunteermanagement.dto.OrgMembershipDTO;
import com.example.volunteermanagement.dto.TeamMemberDTO;
import com.example.volunteermanagement.dto.UserDTO;
import com.example.volunteermanagement.dto.UserStatsDTO;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.ApplicationRepository;
import com.example.volunteermanagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final AuditLogService auditLogService; // <-- ÚJ: Injektáltuk az Audit Loggert!
    private final ApplicationRepository applicationRepository;

    @Transactional(readOnly = true)
    public List<TeamMemberDTO> getTeamMembers(String requesterEmail) {
        User requester = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));

        List<User> targetUsers;

        if (requester.getRole() == Role.SYS_ADMIN) {
            targetUsers = userRepository.findAll();
        } else {
            List<Long> myManagedOrgIds = requester.getMemberships().stream()
                    .filter(m -> m.getStatus() == MembershipStatus.APPROVED &&
                            (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER))
                    .map(m -> m.getOrganization().getId())
                    .collect(Collectors.toList());

            if (myManagedOrgIds.isEmpty()) {
                throw new RuntimeException("Nincs jogosultságod a csapat megtekintéséhez.");
            }

            targetUsers = userRepository.findUsersByOrganizationIds(myManagedOrgIds);
        }

        return targetUsers.stream().map(user -> {
                    List<OrgMembershipDTO> orgDTOs = user.getMemberships().stream()
                            .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                            .map(m -> new OrgMembershipDTO(
                                    m.getOrganization().getId(),
                                    m.getOrganization().getName(),
                                    m.getRole().name(),
                                    m.getStatus().name(),
                                    m.getRejectionMessage()
                            ))
                            .collect(Collectors.toList());

                    if (orgDTOs.isEmpty() && requester.getRole() != Role.SYS_ADMIN) {
                        return null;
                    }

                    return new TeamMemberDTO(
                            user.getId(),
                            user.getName(),
                            user.getEmail(),
                            user.getRole().name(),
                            user.getPhoneNumber(),
                            orgDTOs
                    );
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    // 5. SZERVEZETI SZEREPKÖR MÓDOSÍTÁSA (Naplózással!)
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

        OrganizationRole oldRole = targetMembership.getRole(); // Elmentjük a régit a naplózáshoz
        targetMembership.setRole(newRole);

        // --- ÚJ: ADATBÁZIS NAPLÓZÁS ---
        auditLogService.logAction(
                requesterEmail,
                "ORG_ROLE_UPDATE",
                "Célpont: " + targetUser.getEmail(),
                "Szerepkör módosítva: " + oldRole + " -> " + newRole,
                orgId // Jól látszik a Szervezeti Naplóban
        );
    }

    // 6. TAG ELTÁVOLÍTÁSA A SZERVEZETBŐL (Naplózással!)
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

        // --- ÚJ: ADATBÁZIS NAPLÓZÁS ---
        auditLogService.logAction(
                requesterEmail,
                "REMOVE_MEMBER",
                "Eltávolított felhasználó: " + targetUser.getEmail(),
                "A szervező eltávolította a tagot a csapatból.",
                orgId // A szervezeti naplóba kerül
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
                        m.getStatus().name(),
                        m.getRejectionMessage()
                ))
                .collect(Collectors.toList());

        int activeOrgs = (int) user.getMemberships().stream()
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .count();

        // --- ÚJ STATISZTIKA SZÁMÍTÓ LOGIKA ITT KEZDŐDIK ---

        // 1. Lekérjük a már befejezett, elfogadott jelentkezéseket
        List<Application> completedApps = applicationRepository.findCompletedApplicationsByUser(user.getId());

        // 2. Kiszámoljuk a befejezett események számát (distinct a biztonság kedvéért, nehogy egy eseményen több műszak duplán számítson)
        int completedEvents = (int) completedApps.stream()
                .map(a -> a.getEvent().getId())
                .distinct()
                .count();

        // 3. Kiszámoljuk az összes munkaórát Java-ban
        int totalHours = completedApps.stream()
                .mapToInt(a -> {
                    if (a.getEvent().getStartTime() == null || a.getEvent().getEndTime() == null) {
                        return 0; // Biztonsági ellenőrzés
                    }
                    java.time.Duration duration = java.time.Duration.between(
                            a.getEvent().getStartTime(),
                            a.getEvent().getEndTime()
                    );
                    return (int) duration.toHours();
                })
                .sum();

        // Létrehozzuk a DTO-t a frontendnek
        UserStatsDTO stats = new UserStatsDTO(totalHours, completedEvents, activeOrgs);

        // --- ÚJ STATISZTIKA SZÁMÍTÓ LOGIKA ITT VÉGET ÉR ---

        return new UserDTO(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                user.getPhoneNumber(),
                memberships,
                stats
        );
    }

    // 7. GDPR FIÓKTÖRLÉS (Naplózással!)
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

        // --- ÚJ: ADATBÁZIS NAPLÓZÁS ---
        auditLogService.logAction(
                currentEmail, // Bár a fiók törlődik, az emailt megőrizzük a logban a nyomon követhetőség miatt
                "ACCOUNT_DELETED",
                "Saját fiók",
                "A felhasználó élt a GDPR törlési jogával, a fiók anonimizálva lett.",
                null // Ez rendszerszintű esemény
        );

        log.warn("AUDIT GDPR: Fiók véglegesen törölve és anonimizálva! Eredeti (most már törölt) email: {}", currentEmail);
    }
}