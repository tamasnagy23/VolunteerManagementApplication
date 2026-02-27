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

        // Ellenőrizzük, hogy jelentkezett-e már ide (akár PENDING, akár APPROVED)
        boolean alreadyApplied = user.getMemberships().stream()
                .anyMatch(m -> m.getOrganization().getId().equals(orgId));

        if (alreadyApplied) {
            throw new RuntimeException("Már jelentkeztél ebbe a szervezetbe, vagy már tagja vagy!");
        }

        // Létrehozzuk az új tagságot PENDING (Függőben) státusszal
        OrganizationMember application = OrganizationMember.builder()
                .user(user)
                .organization(org)
                .role(OrganizationRole.VOLUNTEER) // Alapból mindenki önkéntesként indul
                .status(MembershipStatus.PENDING) // <-- EZ ITT A LÉNYEG!
                .joinedAt(LocalDateTime.now())
                .build();

        organizationMemberRepository.save(application);
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

        // JAVÍTOTT MAPPER: Hozzáadtuk a workArea adatokat ÉS a státuszt (9. paraméter)
        return pending.stream()
                .map(m -> new PendingApplicationDTO(
                        m.getId(),
                        m.getUser().getName(),
                        m.getUser().getEmail(),
                        m.getUser().getPhoneNumber(),
                        m.getOrganization().getName(),
                        m.getOrganization().getId(),
                        null,   // workAreaId
                        null,   // workAreaName
                        ApplicationStatus.valueOf(m.getStatus().name()),
                        null,   // eventId
                        null,   // eventTitle
                        java.util.Collections.emptyMap() // ÚJ: Üres válasz-map a szervezeti tagsághoz
                )).collect(Collectors.toList());
    }

    // 4. Jelentkezés elbírálása (Elfogad / Elutasít)
    @Transactional
    public void handleApplication(Long membershipId, String status) {
        OrganizationMember member = organizationMemberRepository.findById(membershipId)
                .orElseThrow(() -> new RuntimeException("Jelentkezés nem található"));

        if ("APPROVED".equalsIgnoreCase(status)) {
            member.setStatus(MembershipStatus.APPROVED);
        } else if ("REJECTED".equalsIgnoreCase(status)) {
            // Elutasítás esetén beállítjuk a REJECTED státuszt (így később nem tud újra jelentkezni próbálkozás gyanánt,
            // de ha azt akarod, hogy újra próbálkozhasson, használhatod a organizationMemberRepository.delete(member); parancsot is).
            member.setStatus(MembershipStatus.REJECTED);
        } else {
            throw new RuntimeException("Érvénytelen státusz: " + status);
        }

        organizationMemberRepository.save(member);
    }
}