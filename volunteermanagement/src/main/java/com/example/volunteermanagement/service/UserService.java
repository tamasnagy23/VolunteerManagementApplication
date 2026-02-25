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

        // Itt a konvertálás a DTO-ba marad a korábbi (szervezeti tagságokat is tartalmazó) verzió
        // ... a getTeamMembers metóduson belül ...
        return targetUsers.stream().map(user -> {
            List<OrgMembershipDTO> orgDTOs = user.getMemberships().stream()
                    .map(m -> new OrgMembershipDTO(
                            m.getOrganization().getId(),
                            m.getOrganization().getName(),
                            m.getRole().name(),
                            m.getStatus().name() // <--- EZT AZ EGY SORT ADD HOZZÁ ITT IS!
                    ))
                    .collect(Collectors.toList());
            // ...

            return new TeamMemberDTO(
                    user.getId(),
                    user.getName(),
                    user.getEmail(),
                    user.getRole().name(), // Ez most már csak USER vagy SYS_ADMIN lesz
                    user.getPhoneNumber(),
                    orgDTOs
            );
        }).collect(Collectors.toList());
    }

    // ... a meglévő metódusaid (pl. getTeamMembers) után illeszd be:

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
                        m.getStatus().name() // Itt a varázslat: átadjuk a státuszt
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