package com.example.volunteermanagement.service;

import com.example.volunteermanagement.dto.OrganizationDTO;
import com.example.volunteermanagement.dto.PendingApplicationDTO;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.OrganizationMemberRepository;
import com.example.volunteermanagement.repository.OrganizationRepository;
import com.example.volunteermanagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final OrganizationMemberRepository organizationMemberRepository;
    private final AuditLogService auditLogService;

    // 1. Összes szervezet kilistázása
    public List<OrganizationDTO> getAllOrganizations() {
        return organizationRepository.findAll().stream()
                .map(org -> new OrganizationDTO(
                        org.getId(),
                        org.getName(),
                        org.getAddress(),
                        org.getDescription(),
                        org.getEmail(),
                        org.getPhone()
                ))
                .collect(Collectors.toList());
    }

    // 2. Csatlakozás (Javítva: 5 paraméteres naplózás)
    @Transactional
    public void joinOrganization(Long orgId, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new RuntimeException("Szervezet nem található"));

        Optional<OrganizationMember> existingMembership = organizationMemberRepository.findByOrganizationAndUser(org, user);

        if (existingMembership.isPresent()) {
            OrganizationMember membership = existingMembership.get();
            if (membership.getStatus() == MembershipStatus.REJECTED ||
                    membership.getStatus() == MembershipStatus.LEFT ||
                    membership.getStatus() == MembershipStatus.REMOVED) {

                membership.setStatus(MembershipStatus.PENDING);
                membership.setRole(OrganizationRole.VOLUNTEER);
                organizationMemberRepository.save(membership);

                // Naplózás az újrajelentkezésről
                auditLogService.logAction(userEmail, "REJOIN_ORGANIZATION", "Szervezet: " + org.getName(), "Újrajelentkezés a szervezetbe.", orgId);
                return;
            } else {
                throw new RuntimeException("Már jelentkeztél ide, vagy már tag vagy!");
            }
        }

        OrganizationMember newMember = new OrganizationMember();
        newMember.setOrganization(org);
        newMember.setUser(user);
        newMember.setRole(OrganizationRole.VOLUNTEER);
        newMember.setStatus(MembershipStatus.PENDING);
        organizationMemberRepository.save(newMember);

        // JAVÍTVA: 5 paraméter (orgId a végén)
        auditLogService.logAction(
                userEmail,
                "JOIN_ORGANIZATION",
                "Szervezet ID: " + orgId,
                "A felhasználó jelentkezett a szervezetbe (Függő státusz).",
                orgId
        );
    }

    @Transactional
    public void updateMemberRole(Long orgId, Long memberUserId, OrganizationRole newRole, String adminEmail) {
        User admin = userRepository.findByEmail(adminEmail).orElseThrow();
        Organization org = organizationRepository.findById(orgId).orElseThrow();

        // JAVÍTÁS: SYS_ADMIN jogosultság ellenőrzése
        if (admin.getRole() != Role.SYS_ADMIN) {
            OrganizationMember adminMembership = organizationMemberRepository.findByOrganizationAndUser(org, admin)
                    .orElseThrow(() -> new RuntimeException("Nincs jogosultságod ebben a szervezetben!"));
            if (adminMembership.getRole() != OrganizationRole.OWNER && adminMembership.getRole() != OrganizationRole.ORGANIZER) {
                throw new RuntimeException("Csak vezető módosíthat szerepkört!");
            }
        }

        User targetUser = userRepository.findById(memberUserId).orElseThrow();
        OrganizationMember member = organizationMemberRepository.findByOrganizationAndUser(org, targetUser)
                .orElseThrow(() -> new RuntimeException("Tag nem található"));

        OrganizationRole oldRole = member.getRole();
        member.setRole(newRole);
        organizationMemberRepository.save(member);

        // NAPLÓZÁS
        auditLogService.logAction(
                adminEmail,
                "ROLE_UPDATE",
                "Felhasználó: " + targetUser.getEmail(),
                "Szerepkör módosítva: " + oldRole + " -> " + newRole,
                orgId
        );
    }

    // 3. Függő jelentkezések (Maradt változatlan)
    public List<PendingApplicationDTO> getPendingApplications(String adminEmail) {
        User admin = userRepository.findByEmail(adminEmail).orElseThrow();
        List<OrganizationMember> pending;

        if (admin.getRole() == com.example.volunteermanagement.model.Role.SYS_ADMIN) {
            pending = organizationMemberRepository.findByStatus(MembershipStatus.PENDING);
        } else {
            List<Long> myOrgIds = admin.getMemberships().stream()
                    .filter(m -> m.getStatus() == MembershipStatus.APPROVED &&
                            (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER))
                    .map(m -> m.getOrganization().getId())
                    .collect(Collectors.toList());

            if (myOrgIds.isEmpty()) return List.of();
            pending = organizationMemberRepository.findByStatusAndOrganizationIdIn(MembershipStatus.PENDING, myOrgIds);
        }

        return pending.stream().map(this::mapMembershipToDTO).collect(Collectors.toList());
    }

    // 4. Elbírálás
    @Transactional
    public void handleApplication(Long membershipId, String status, String rejectionMessage, String adminEmail) {
        User admin = userRepository.findByEmail(adminEmail).orElseThrow();
        OrganizationMember member = organizationMemberRepository.findById(membershipId)
                .orElseThrow(() -> new RuntimeException("Jelentkezés nem található"));

        Long orgId = member.getOrganization().getId();

        // JAVÍTÁS: SYS_ADMIN jogosultság ellenőrzése
        if (admin.getRole() != Role.SYS_ADMIN) {
            OrganizationMember adminMembership = organizationMemberRepository.findByOrganizationAndUser(member.getOrganization(), admin)
                    .orElseThrow(() -> new RuntimeException("Nincs jogosultságod ebben a szervezetben!"));
            if (adminMembership.getRole() != OrganizationRole.OWNER && adminMembership.getRole() != OrganizationRole.ORGANIZER) {
                throw new RuntimeException("Csak vezető bírálhat el jelentkezést!");
            }
        }

        if ("APPROVED".equalsIgnoreCase(status)) {
            member.setStatus(MembershipStatus.APPROVED);
            member.setRejectionMessage(null);

            auditLogService.logAction(adminEmail, "APPROVE_MEMBERSHIP", "Tag: " + member.getUser().getEmail(), "Jelentkezés elfogadva.", orgId);
        } else if ("REJECTED".equalsIgnoreCase(status)) {
            member.setStatus(MembershipStatus.REJECTED);
            member.setRejectionMessage(rejectionMessage);

            auditLogService.logAction(adminEmail, "REJECT_MEMBERSHIP", "Tag: " + member.getUser().getEmail(), "Jelentkezés elutasítva. Indok: " + rejectionMessage, orgId);
        }

        organizationMemberRepository.save(member);
    }

    // 5. Kilépés (Javítva: Naplózás hozzáadva)
    @Transactional
    public void leaveOrganization(Long orgId, String userEmail) {
        User user = userRepository.findByEmail(userEmail).orElseThrow();
        OrganizationMember member = user.getMemberships().stream()
                .filter(m -> m.getOrganization().getId().equals(orgId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Nem vagy tagja ennek a szervezetnek!"));

        if (member.getRole() == OrganizationRole.OWNER) {
            throw new RuntimeException("Alapítóként nem léphetsz ki!");
        }

        member.setStatus(MembershipStatus.LEFT);
        organizationMemberRepository.save(member);

        auditLogService.logAction(userEmail, "LEAVE_ORGANIZATION", "Szervezet ID: " + orgId, "A felhasználó kilépett a szervezetből.", orgId);
    }

    // Tag eltávolítása
    @Transactional
    public void removeMember(Long orgId, Long memberUserId, String requesterEmail) {
        User requester = userRepository.findByEmail(requesterEmail).orElseThrow();
        Organization org = organizationRepository.findById(orgId).orElseThrow();

        // JAVÍTÁS: Ha a kérdező SYS_ADMIN, egyből továbbengedjük, nem keressük a saját tagságát
        if (requester.getRole() != Role.SYS_ADMIN) {
            OrganizationMember requesterMembership = organizationMemberRepository.findByOrganizationAndUser(org, requester)
                    .orElseThrow(() -> new RuntimeException("Nincs jogosultságod!"));

            if (requesterMembership.getRole() == OrganizationRole.VOLUNTEER) {
                throw new RuntimeException("Önkéntesek nem távolíthatnak el tagokat!");
            }
        }

        User userToRemove = userRepository.findById(memberUserId).orElseThrow();
        OrganizationMember memberToRemove = organizationMemberRepository.findByOrganizationAndUser(org, userToRemove).orElseThrow();

        if (memberToRemove.getRole() == OrganizationRole.OWNER) {
            throw new RuntimeException("Alapítót nem lehet eltávolítani!");
        }

        memberToRemove.setStatus(MembershipStatus.REMOVED);
        organizationMemberRepository.save(memberToRemove);

        auditLogService.logAction(
                requesterEmail,
                "REMOVE_MEMBER",
                "Eltávolított felhasználó: " + userToRemove.getEmail(),
                "A szervező eltávolította a tagot a szervezetből.",
                orgId
        );
    }

    // Segédmetódus a DTO-hoz (Kód tisztítás)
    private PendingApplicationDTO mapMembershipToDTO(OrganizationMember m) {
        return new PendingApplicationDTO(
                m.getId(), m.getUser().getName(), m.getUser().getEmail(), m.getUser().getPhoneNumber(),
                m.getOrganization().getName(), m.getOrganization().getId(), null, null,
                m.getStatus().name(), null, null, java.util.Collections.emptyMap(),
                null, null, null, null, m.getRejectionMessage(), null
        );
    }

    public List<PendingApplicationDTO> getHistory(String adminEmail) {
        User admin = userRepository.findByEmail(adminEmail).orElseThrow();
        List<MembershipStatus> historyStatuses = List.of(MembershipStatus.LEFT, MembershipStatus.REJECTED, MembershipStatus.REMOVED);
        List<OrganizationMember> history;

        if (admin.getRole() == com.example.volunteermanagement.model.Role.SYS_ADMIN) {
            history = organizationMemberRepository.findByStatusIn(historyStatuses);
        } else {
            List<Long> myOrgIds = admin.getMemberships().stream()
                    .filter(m -> m.getStatus() == MembershipStatus.APPROVED &&
                            (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER))
                    .map(m -> m.getOrganization().getId())
                    .collect(Collectors.toList());

            if (myOrgIds.isEmpty()) return List.of();
            history = organizationMemberRepository.findByStatusInAndOrganizationIdIn(historyStatuses, myOrgIds);
        }

        return history.stream().map(m -> new PendingApplicationDTO(
                m.getId(), m.getUser().getName(), m.getUser().getEmail(), "Rejtett adat (GDPR)",
                m.getOrganization().getName(), m.getOrganization().getId(), null, null,
                m.getStatus().name(), null, null, java.util.Collections.emptyMap(),
                null, null, null, null, m.getRejectionMessage(), null
        )).collect(Collectors.toList());
    }
}