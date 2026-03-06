package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.TeamMemberDTO;
import com.example.volunteermanagement.model.Role;
import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.repository.UserRepository;
import com.example.volunteermanagement.service.AuditLogService;
import com.example.volunteermanagement.service.EmailService;
import com.example.volunteermanagement.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
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
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;

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

    // 4. GLOBÁLIS SZEREPKÖR MÓDOSÍTÁSA (Naplózással)
    @PutMapping("/{id}/role")
    @PreAuthorize("hasAuthority('SYS_ADMIN')")
    public ResponseEntity<User> updateGlobalRole(@PathVariable Long id, @RequestParam String newRole, Principal principal) {
        User userToUpdate = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Felhasználó nem található"));

        Role oldRole = userToUpdate.getRole();
        Role newRoleEnum;
        try {
            newRoleEnum = Role.valueOf(newRole);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Érvénytelen globális szerepkör");
        }

        if (userToUpdate.getRole() == Role.SYS_ADMIN && newRoleEnum != Role.SYS_ADMIN) {
            if (userRepository.countByRole(Role.SYS_ADMIN) <= 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nem fokozhatod le az utolsó Rendszergazdát!");
            }
        }

        userToUpdate.setRole(newRoleEnum);
        User savedUser = userRepository.save(userToUpdate);

        // --- NAPLÓZÁS (Rendszerszintű, orgId = null) ---
        auditLogService.logAction(
                principal.getName(),
                "GLOBAL_ROLE_UPDATE",
                "Felhasználó: " + userToUpdate.getEmail(),
                "Módosítás: " + oldRole + " -> " + newRoleEnum,
                null
        );

        return ResponseEntity.ok(savedUser);
    }

    // 5. SZERVEZETI SZEREPKÖR MÓDOSÍTÁSA
    @PutMapping("/{userId}/organizations/{orgId}/role")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> updateOrganizationRole(
            @PathVariable Long userId,
            @PathVariable Long orgId,
            @RequestParam String newRole,
            Principal principal) {

        try {
            // Itt csak a szervizt hívjuk meg, a naplózást maga a UserService végzi el!
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

    // Segéd record a kérés beolvasásához
    public record BulkTeamEmailRequest(List<Long> userIds, String subject, String message) {}

    // 7. TÖMEGES EMAIL KÜLDÉS CSAPATNAK (Naplózással)
    @PostMapping("/team/bulk-email")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> sendBulkTeamEmail(
            @RequestBody BulkTeamEmailRequest request,
            Principal principal) {

        User admin = userRepository.findByEmail(principal.getName()).orElseThrow();
        List<User> targetUsers = userRepository.findAllById(request.userIds());
        List<String> bccEmails = targetUsers.stream().map(User::getEmail).toList();

        if (!bccEmails.isEmpty()) {
            emailService.sendBulkEmailBcc(bccEmails, request.subject(), request.message());

            // --- NAPLÓZÁS ---
            auditLogService.logAction(
                    principal.getName(),
                    "TEAM_BULK_EMAIL",
                    "Címzettek száma: " + bccEmails.size(),
                    "Tárgy: " + request.subject(),
                    null // Ha ez nem egy konkrét szervezethez kötött, akkor null
            );
        }
        return ResponseEntity.ok("Csapat e-mailek elküldve.");
    }

    // 8. FIÓKTÖRLÉS
    @DeleteMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> deleteMyAccount(Principal principal) {
        try {
            userService.anonymizeMyAccount(principal.getName(), passwordEncoder);
            return ResponseEntity.ok("Fiók sikeresen törölve és anonimizálva.");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}