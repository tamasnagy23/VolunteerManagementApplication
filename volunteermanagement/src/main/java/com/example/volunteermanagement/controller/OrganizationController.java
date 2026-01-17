package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.UserDTO;
import com.example.volunteermanagement.model.Role;
import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/organization")
@RequiredArgsConstructor
public class OrganizationController {

    private final UserRepository userRepository;

    // 1. Tagok listázása (Csak a saját szervezetem tagjait látom!)
    @GetMapping("/members")
    public ResponseEntity<List<UserDTO>> getMyMembers(Principal principal) {
        // Megkeressük, ki kérdezi (pl. Főszervező Ferenc)
        User currentUser = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));

        if (currentUser.getOrganization() == null) {
            throw new RuntimeException("Nincs szervezeted!");
        }

        // Lekérjük a szervezet összes tagját
        List<User> members = currentUser.getOrganization().getMembers();

        // Átalakítjuk őket biztonságos DTO-vá
        List<UserDTO> memberDtos = members.stream()
                .map(u -> new UserDTO(u.getId(), u.getName(), u.getEmail(), u.getRole()))
                .collect(Collectors.toList());

        return ResponseEntity.ok(memberDtos);
    }

    // 2. Kinevezés Koordinátorrá (Role módosítás)
    @PutMapping("/members/{id}/promote")
    public ResponseEntity<String> promoteToCoordinator(@PathVariable Long id, Principal principal) {

        User admin = userRepository.findByEmail(principal.getName())
                .orElseThrow();

        // Biztonsági ellenőrzés: Csak ORGANIZER vagy ADMIN nevezhet ki
        if (admin.getRole() != Role.ORGANIZER && admin.getRole() != Role.SYS_ADMIN) {
            return ResponseEntity.status(403).body("Nincs jogod ehhez! Csak Szervező nevezhet ki koordinátort.");
        }

        User targetUser = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));

        // Biztonsági ellenőrzés: A célpont ugyanabban a szervezetben van?
        if (!targetUser.getOrganization().getId().equals(admin.getOrganization().getId())) {
            return ResponseEntity.status(403).body("Ez a felhasználó nem a te szervezetedhez tartozik!");
        }

        // Kinevezés
        targetUser.setRole(Role.COORDINATOR);
        userRepository.save(targetUser);

        return ResponseEntity.ok(targetUser.getName() + " mostantól Koordinátor!");
    }
}