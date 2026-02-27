package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.TeamMemberDTO;
import com.example.volunteermanagement.model.Role;
import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.repository.UserRepository;
import com.example.volunteermanagement.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final UserService userService;

    // 1. Összes felhasználó lekérése (Csak SYS_ADMIN-nak)
    @GetMapping
    @PreAuthorize("hasAuthority('SYS_ADMIN')")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userRepository.findAll());
    }

    // 2. Saját profil adatai
    @GetMapping("/me")
    public ResponseEntity<com.example.volunteermanagement.dto.UserDTO> getCurrentUser(Principal principal) {
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Felhasználó nem található"));
        return ResponseEntity.ok(userService.getCurrentUserProfile(principal.getName()));
    }

    // 3. CSAPAT LEKÉRÉSE (Minden bejelentkezett láthatja, a szűrést a Service végzi!)
    @GetMapping("/team")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<TeamMemberDTO>> getTeamMembers(Principal principal) {
        List<TeamMemberDTO> team = userService.getTeamMembers(principal.getName());
        return ResponseEntity.ok(team);
    }

    // 4. GLOBÁLIS SZEREPKÖR MÓDOSÍTÁSA (Csak SYS_ADMIN vagy USER lehet!)
    // Ezt már csak a legvégső esetben használjuk (pl. kinevezni egy új rendszert admint)
    @PutMapping("/{id}/role")
    @PreAuthorize("hasAuthority('SYS_ADMIN')")
    public ResponseEntity<User> updateGlobalRole(@PathVariable Long id, @RequestParam String newRole) {
        User userToUpdate = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Felhasználó nem található"));

        Role newRoleEnum;
        try {
            newRoleEnum = Role.valueOf(newRole);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Érvénytelen globális szerepkör");
        }

        // Védelem az utolsó Rendszergazda ellen
        if (userToUpdate.getRole() == Role.SYS_ADMIN && newRoleEnum != Role.SYS_ADMIN) {
            if (userRepository.countByRole(Role.SYS_ADMIN) <= 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nem fokozhatod le az utolsó Rendszergazdát!");
            }
        }

        userToUpdate.setRole(newRoleEnum);
        return ResponseEntity.ok(userRepository.save(userToUpdate));
    }

    // 5. ÚJ: SZERVEZETI SZEREPKÖR MÓDOSÍTÁSA (Ez a lényeg!)
    // Ezt fogja hívni a Frontend legördülő menüje
    @PutMapping("/{userId}/organizations/{orgId}/role")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> updateOrganizationRole(
            @PathVariable Long userId,
            @PathVariable Long orgId,
            @RequestParam String newRole,
            Principal principal) {

        try {
            userService.updateOrganizationRole(userId, orgId, newRole, principal.getName());
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    // 6. ÚJ: TAG ELTÁVOLÍTÁSA A SZERVEZETBŐL
    @DeleteMapping("/{userId}/organizations/{orgId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> removeOrganizationMember(
            @PathVariable Long userId,
            @PathVariable Long orgId,
            Principal principal) {
        try {
            userService.removeMemberFromOrganization(userId, orgId, principal.getName());
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }
}