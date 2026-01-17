package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.model.Organization;
import com.example.volunteermanagement.model.Role;
import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.repository.UserRepository;
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

    @GetMapping
    @PreAuthorize("hasAnyAuthority('SYS_ADMIN', 'ORGANIZER')")
    public ResponseEntity<List<User>> getAllUsers() {
        List<User> users = userRepository.findAll();
        return ResponseEntity.ok(users);
    }

    // Ez a végpont visszaadja a bejelentkezett felhasználó adatait (profil)
    @GetMapping("/me")
    public ResponseEntity<User> getCurrentUser(Principal principal) {
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));

        return ResponseEntity.ok(user);
    }

    @PutMapping("/{id}/role")
    @PreAuthorize("hasAnyAuthority('SYS_ADMIN', 'ORGANIZER')")
    public ResponseEntity<User> updateUserRole(@PathVariable Long id, @RequestParam String newRole, Principal principal) {

        User userToUpdate = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található: " + id));

        User requester = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("Bejelentkezett felhasználó nem található"));

        Role newRoleEnum;
        try {
            newRoleEnum = Role.valueOf(newRole);
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Érvénytelen szerepkör");
        }

        // --- 1. BIZTONSÁGI VÉDELEM: UTOLSÓ RENDSZERGAZDA ---
        // Ha a felhasználó jelenleg SYS_ADMIN, de az új szerep NEM az...
        if (userToUpdate.getRole() == Role.SYS_ADMIN && newRoleEnum != Role.SYS_ADMIN) {
            long sysAdminCount = userRepository.countByRole(Role.SYS_ADMIN);
            if (sysAdminCount <= 1) {
                // 400 Bad Request hibát dobunk
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nem fokozhatod le az utolsó Rendszergazdát!");
            }
        }

        // --- 2. BIZTONSÁGI VÉDELEM: UTOLSÓ SZERVEZŐ (Adott Szervezetben) ---
        // Ha a felhasználó jelenleg ORGANIZER, de az új szerep NEM az...
        if (userToUpdate.getRole() == Role.ORGANIZER && newRoleEnum != Role.ORGANIZER) {
            Organization org = userToUpdate.getOrganization();
            if (org != null) {
                long organizerCount = userRepository.countByOrganizationAndRole(org, Role.ORGANIZER);
                if (organizerCount <= 1) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nem fokozhatod le a szervezet utolsó Szervezőjét!");
                }
            }
        }

        // --- 3. JOGOSULTSÁG ELLENŐRZÉS (A korábbi kódod) ---
        if (newRoleEnum == Role.SYS_ADMIN && requester.getRole() != Role.SYS_ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Csak Rendszergazda nevezhet ki új Rendszergazdát!");
        }

        // ... (többi ellenőrzés ha van) ...

        // Ha minden ellenőrzésen átment, mehet a mentés
        userToUpdate.setRole(newRoleEnum);
        User updatedUser = userRepository.save(userToUpdate);

        return ResponseEntity.ok(updatedUser);
    }
    // HA volt itt olyan metódus, ami a műszakokat adta vissza (és hibát dobott),
    // azt most TÖRÖLTÜK, mert az EventController-ben lévő '/my-shifts' végpontot használjuk helyette!
    // Ez így sokkal tisztább, és megszünteti a List vs Set konfliktust.
}