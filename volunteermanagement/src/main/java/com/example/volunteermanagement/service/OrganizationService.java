package com.example.volunteermanagement.service;

import com.example.volunteermanagement.dto.OrganizationDTO;
import com.example.volunteermanagement.dto.PendingApplicationDTO;
import com.example.volunteermanagement.model.MembershipStatus;
import com.example.volunteermanagement.model.Organization;
import com.example.volunteermanagement.model.OrganizationMember;
import com.example.volunteermanagement.model.OrganizationRole;
import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.repository.OrganizationMemberRepository;
import com.example.volunteermanagement.repository.OrganizationRepository;
import com.example.volunteermanagement.repository.UserRepository;
import com.example.volunteermanagement.model.ApplicationStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final OrganizationMemberRepository organizationMemberRepository;

    // 1. Összes szervezet kilistázása a Katalógushoz
    public List<OrganizationDTO> getAllOrganizations() {
        return organizationRepository.findAll().stream()
                .map(org -> new OrganizationDTO(
                        org.getId(),
                        org.getName(),
                        org.getAddress(),
                        org.getDescription(), // ÚJ
                        org.getEmail(),       // ÚJ
                        org.getPhone()        // ÚJ
                ))
                .collect(Collectors.toList());
    }

    // 2. Csatlakozás egy szervezethez (PENDING státusszal)
    @Transactional
    public void joinOrganization(Long orgId, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new RuntimeException("Szervezet nem található"));

        // Megnézzük, van-e már valamilyen tagsági kapcsolata ezzel a szervezettel
        Optional<OrganizationMember> existingMembership = organizationMemberRepository.findByOrganizationAndUser(org, user);

        if (existingMembership.isPresent()) {
            OrganizationMember membership = existingMembership.get();

            // Ha ELUTASÍTOTTÁK VAGY KILÉPETT, újrajelentkezhet:
            if (membership.getStatus() == MembershipStatus.REJECTED || membership.getStatus() == MembershipStatus.LEFT) {
                membership.setStatus(MembershipStatus.PENDING);
                membership.setRole(OrganizationRole.VOLUNTEER);
                organizationMemberRepository.save(membership);
                return;
            } else {
                throw new RuntimeException("Már jelentkeztél ide, vagy már tag vagy!");
            }
        }

        // HA MÉG SOHA NEM JELENTKEZETT: Új rekordot hozunk létre
        OrganizationMember newMember = new OrganizationMember();
        newMember.setOrganization(org);
        newMember.setUser(user);
        newMember.setRole(OrganizationRole.VOLUNTEER);
        newMember.setStatus(MembershipStatus.PENDING);
        organizationMemberRepository.save(newMember);
    }

    // --- ÚJ METÓDUSOK A CSAPAT KEZELÉSÉHEZ ---

    // 3. Függőben lévő jelentkezések lekérése a vezetőnek
    public List<PendingApplicationDTO> getPendingApplications(String adminEmail) {
        User admin = userRepository.findByEmail(adminEmail)
                .orElseThrow(() -> new RuntimeException("Admin nem található"));

        List<OrganizationMember> pending;

        if (admin.getRole() == com.example.volunteermanagement.model.Role.SYS_ADMIN) {
            pending = organizationMemberRepository.findByStatus(MembershipStatus.PENDING);
        } else {
            List<Long> myOrgIds = admin.getMemberships().stream()
                    .filter(m -> m.getStatus() == MembershipStatus.APPROVED &&
                            (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER))
                    .map(m -> m.getOrganization().getId())
                    .collect(Collectors.toList());

            if (myOrgIds.isEmpty()) {
                return List.of();
            }

            pending = organizationMemberRepository.findByStatusAndOrganizationIdIn(MembershipStatus.PENDING, myOrgIds);
        }

        // JAVÍTOTT MAPPER a kibővített DTO-hoz
        return pending.stream()
                .map(m -> new PendingApplicationDTO(
                        m.getId(),
                        m.getUser().getName(),
                        m.getUser().getEmail(),
                        m.getUser().getPhoneNumber(),
                        m.getOrganization().getName(),
                        m.getOrganization().getId(),
                        null,
                        null,
                        ApplicationStatus.valueOf(m.getStatus().name()),
                        null,
                        null,
                        java.util.Collections.emptyMap(),
                        null, // userAvatar
                        null, // userJoinDate
                        null,  // userOrgRole
                        null, //adminNote
                        m.getRejectionMessage()
                )).collect(Collectors.toList());
    }

    // 4. Jelentkezés elbírálása (Elfogad / Elutasít) indoklással
    @Transactional
    public void handleApplication(Long membershipId, String status, String rejectionMessage) {
        OrganizationMember member = organizationMemberRepository.findById(membershipId)
                .orElseThrow(() -> new RuntimeException("Jelentkezés nem található"));

        if ("APPROVED".equalsIgnoreCase(status)) {
            member.setStatus(MembershipStatus.APPROVED);
            member.setRejectionMessage(null); // Ha korábban elutasították, de most elfogadják, töröljük az indokot
        } else if ("REJECTED".equalsIgnoreCase(status)) {
            member.setStatus(MembershipStatus.REJECTED);
            member.setRejectionMessage(rejectionMessage); // Elmentjük a szervező indoklását
        } else {
            throw new RuntimeException("Érvénytelen státusz: " + status);
        }

        organizationMemberRepository.save(member);
    }

    // Kilépés a szervezetből (Kivéve az Alapítóknak)
    @Transactional
    public void leaveOrganization(Long orgId, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));

        OrganizationMember member = user.getMemberships().stream()
                .filter(m -> m.getOrganization().getId().equals(orgId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Nem vagy tagja ennek a szervezetnek!"));

        if (member.getRole() == OrganizationRole.OWNER) {
            throw new RuntimeException("Alapítóként nem léphetsz ki! Kérlek, előbb ruházd át a jogkört.");
        }

        // --- SOFT DELETE: Törlés helyett csak státuszt váltunk ---
        member.setStatus(MembershipStatus.LEFT);
        organizationMemberRepository.save(member);
    }
}