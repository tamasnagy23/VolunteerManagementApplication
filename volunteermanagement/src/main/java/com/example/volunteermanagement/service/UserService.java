package com.example.volunteermanagement.service;

import com.example.volunteermanagement.dto.OrgMembershipDTO;
import com.example.volunteermanagement.dto.TeamMemberDTO;
import com.example.volunteermanagement.dto.UserDTO;
import com.example.volunteermanagement.model.MembershipStatus;
import com.example.volunteermanagement.model.OrganizationRole;
import com.example.volunteermanagement.model.Role;
import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<TeamMemberDTO> getTeamMembers(String requesterEmail) {
        User requester = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));

        List<User> targetUsers;

        if (requester.getRole() == Role.SYS_ADMIN) {
            targetUsers = userRepository.findAll();
        } else {
            // Megkeressük azokat a szervezeteket, ahol a lekérdező OWNER vagy ORGANIZER
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

                    // 1. ÚJ SZŰRÉS: Csak az APPROVED tagságokat vesszük figyelembe a csapatlistánál!
                    List<OrgMembershipDTO> orgDTOs = user.getMemberships().stream()
                            .filter(m -> m.getStatus() == MembershipStatus.APPROVED) // <--- EZT ADTUK HOZZÁ
                            .map(m -> new OrgMembershipDTO(
                                    m.getOrganization().getId(),
                                    m.getOrganization().getName(),
                                    m.getRole().name(),
                                    m.getStatus().name(),
                                    m.getRejectionMessage()
                            ))
                            .collect(Collectors.toList());

                    // 2. ÚJ VÉDELEM: Ha az illetőnek a szűrés után nincs semmilyen tagsága (pl. csak PENDING volt),
                    // és a lekérdező nem SYS_ADMIN, akkor őt nem tesszük bele a listába!
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
                .filter(Objects::nonNull) // 3. ÚJ VÉDELEM: Kiszűrjük a null értékeket a végső listából
                .collect(Collectors.toList());
    }

    @Transactional
    public void updateOrganizationRole(Long userId, Long orgId, String newRoleStr, String requesterEmail) {
        // 1. Megkeressük a végrehajtót és a célpontot
        User requester = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new RuntimeException("Hiba a hitelesítésnél"));

        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("A célfelhasználó nem található"));

        // 2. Szöveges szerepkör konvertálása Enummá
        com.example.volunteermanagement.model.OrganizationRole newRole;
        try {
            newRole = com.example.volunteermanagement.model.OrganizationRole.valueOf(newRoleStr);
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Érvénytelen szervezeti szerepkör");
        }

        // 3. Megkeressük a konkrét tagságot a listában
        com.example.volunteermanagement.model.OrganizationMember targetMembership = targetUser.getMemberships().stream()
                .filter(m -> m.getOrganization().getId().equals(orgId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("A felhasználó nem tagja ennek a szervezetnek."));

        // 4. Jogosultság ellenőrzése: Csak SYS_ADMIN vagy az adott szervezet vezetője módosíthat
        boolean isSysAdmin = requester.getRole() == com.example.volunteermanagement.model.Role.SYS_ADMIN;
        boolean isRequesterLeaderHere = requester.getMemberships().stream()
                .anyMatch(m -> m.getOrganization().getId().equals(orgId) &&
                        (m.getRole() == com.example.volunteermanagement.model.OrganizationRole.OWNER ||
                                m.getRole() == com.example.volunteermanagement.model.OrganizationRole.ORGANIZER));

        if (!isSysAdmin && !isRequesterLeaderHere) {
            throw new RuntimeException("Nincs jogosultságod ebben a szervezetben módosítani!");
        }

        // 5. Védelem: Az utolsó vezetőt (OWNER/ORGANIZER) ne lehessen lefokozni
        if ((targetMembership.getRole() == com.example.volunteermanagement.model.OrganizationRole.OWNER ||
                targetMembership.getRole() == com.example.volunteermanagement.model.OrganizationRole.ORGANIZER) &&
                (newRole != com.example.volunteermanagement.model.OrganizationRole.OWNER &&
                        newRole != com.example.volunteermanagement.model.OrganizationRole.ORGANIZER)) {

            long leaderCount = targetMembership.getOrganization().getMembers().stream()
                    .filter(m -> m.getRole() == com.example.volunteermanagement.model.OrganizationRole.OWNER ||
                            m.getRole() == com.example.volunteermanagement.model.OrganizationRole.ORGANIZER)
                    .count();

            if (leaderCount <= 1) {
                throw new RuntimeException("Nem fokozhatod le a szervezet utolsó vezetőjét!");
            }
        }

        // 6. Tényleges módosítás
        targetMembership.setRole(newRole);
        // A @Transactional miatt az adatbázis mentés automatikusan megtörténik a metódus végén
    }

    @Transactional
    public void removeMemberFromOrganization(Long userId, Long orgId, String requesterEmail) {
        User requester = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new RuntimeException("Hiba a hitelesítésnél"));
        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("A célfelhasználó nem található"));

        // 1. Tagság megkeresése
        var targetMembership = targetUser.getMemberships().stream()
                .filter(m -> m.getOrganization().getId().equals(orgId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("A felhasználó nem tagja ennek a szervezetnek."));

        // 2. Jogosultság ellenőrzése (Csak Admin, vagy a szervezet Vezetője törölhet)
        boolean isSysAdmin = requester.getRole() == Role.SYS_ADMIN;
        boolean isRequesterLeaderHere = requester.getMemberships().stream()
                .anyMatch(m -> m.getOrganization().getId().equals(orgId) &&
                        (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER));

        if (!isSysAdmin && !isRequesterLeaderHere) {
            throw new RuntimeException("Nincs jogosultságod eltávolítani ezt a tagot!");
        }

        // 3. Utolsó vezető és ALAPÍTÓ védelme
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

        // 4. Törlés (Feltételezve, hogy a User entitásodban a tagságok listája megfelelően kezeli a törlést)
        targetUser.getMemberships().remove(targetMembership);
        userRepository.save(targetUser);
    }

    @Transactional(readOnly = true)
    public UserDTO getCurrentUserProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));

        // 1. Tagságok kigyűjtése és DTO-vá alakítása STÁTUSSZAL együtt
        List<OrgMembershipDTO> memberships = user.getMemberships().stream()
                .map(m -> new OrgMembershipDTO(
                        m.getOrganization().getId(),
                        m.getOrganization().getName(),
                        m.getRole().name(),
                        m.getStatus().name(),
                        m.getRejectionMessage()// Itt a varázslat: átadjuk a státuszt
                ))
                .collect(Collectors.toList());

        // 2. UserDTO visszaadása a tagságokkal
        return new UserDTO(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                memberships // Itt küldjük le a listát a Reactnek
        );
    }
}