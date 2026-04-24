package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.TeamMemberDTO;
import com.example.volunteermanagement.model.Role;
import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.repository.UserRepository;
import com.example.volunteermanagement.service.AuditLogService;
import com.example.volunteermanagement.service.EmailService;
import com.example.volunteermanagement.service.UserService;
import com.example.volunteermanagement.service.FileStorageService; // <--- ÚJ IMPORT
import com.example.volunteermanagement.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile; // <--- ÚJ IMPORT
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

import java.security.Principal;
import java.util.List;
import java.util.Map; // <--- ÚJ IMPORT

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final UserService userService;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;
    private final FileStorageService fileStorageService; // <--- ÚJ: Fájlkezelő szerviz

    // 1. Összes felhasználó lekérése (Csak SYS_ADMIN-nak)
    @GetMapping
    @PreAuthorize("hasAuthority('SYS_ADMIN')")
    @Transactional(readOnly = true)
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userRepository.findAll());
    }

    // 2. Saját profil adatai
    @GetMapping("/me")
    @Transactional(readOnly = true)
    public ResponseEntity<com.example.volunteermanagement.dto.UserDTO> getCurrentUser(Principal principal) {
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Felhasználó nem található"));
        return ResponseEntity.ok(userService.getCurrentUserProfile(principal.getName()));
    }

    // 3. CSAPAT LEKÉRÉSE
    @GetMapping("/team")
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public ResponseEntity<List<TeamMemberDTO>> getTeamMembers(
            Principal principal,
            @RequestParam(required = false) Long orgId) { // ÚJ PARAMÉTER!

        return ResponseEntity.ok(userService.getTeamMembers(principal.getName(), orgId));
    }

    // 4. GLOBÁLIS SZEREPKÖR MÓDOSÍTÁSA (Naplózással)
    @PutMapping("/{id}/role")
    @PreAuthorize("hasAuthority('SYS_ADMIN')")
    @Transactional
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
            userService.updateOrganizationRole(userId, orgId, newRole, principal.getName());
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    // 6. TAG ELTÁVOLÍTÁSA A SZERVEZETBŐL
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

    public record BulkTeamEmailRequest(List<Long> userIds, String subject, String message, Long orgId) {}

    // 7. TÖMEGES EMAIL KÜLDÉS CSAPATNAK (Naplózással)
    // --- JAVÍTÁS: JSON helyett MULTIPART (FormData) fogadása! ---
    @PostMapping(value = "/team/bulk-email", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> sendBulkTeamEmail(
            @RequestParam("userIds") List<Long> userIds,
            @RequestParam("subject") String subject,
            @RequestParam("message") String message,
            @RequestParam(value = "orgId", required = false) Long requestOrgId,
            @RequestParam(value = "attachments", required = false) List<MultipartFile> attachments, // <-- Fájlok fogadása
            @RequestParam(required = false) Long orgId, // Eredeti orgId az URL-ből
            Principal principal) {

        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();

            Long actualOrgId = requestOrgId != null ? requestOrgId : orgId;

            // Átadjuk az attachments-et a null helyett!
            userService.sendTeamEmail(userIds, subject, message, actualOrgId, principal.getName(), attachments);

            return ResponseEntity.ok(Map.of("message", "Csapat e-mailek elküldve."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
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

    // =========================================================================
    // 9. PROFILKÉP FELTÖLTÉSE (ÚJ VÉGPONT)
    // =========================================================================
    @PostMapping("/me/avatar")
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public ResponseEntity<?> uploadAvatar(@RequestParam("file") MultipartFile file, Principal principal) {
        try {
            // 1. Megkeressük a felhasználót
            User user = userRepository.findByEmail(principal.getName())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Felhasználó nem található"));

            // 2. Lementjük a fájlt az "avatars" mappába
            String fileUrl = fileStorageService.storeFile(file, "avatars");

            // 3. Frissítjük az adatbázisban a kép URL-jét
            user.setProfileImageUrl(fileUrl);
            userRepository.save(user);

            // 4. Visszaküldjük az új URL-t a Reactnek (egy Map-ben becsomagolva)
            return ResponseEntity.ok(Map.of(
                    "message", "Profilkép sikeresen frissítve!",
                    "imageUrl", fileUrl
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================================
    // 10. PROFILKÉP TÖRLÉSE
    // =========================================================================
    @DeleteMapping("/me/avatar")
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public ResponseEntity<?> deleteAvatar(Principal principal) {
        try {
            User user = userRepository.findByEmail(principal.getName())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Felhasználó nem található"));

            // Null-ra állítjuk az URL-t az adatbázisban
            user.setProfileImageUrl(null);
            userRepository.save(user);

            return ResponseEntity.ok(Map.of("message", "Profilkép sikeresen törölve!"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // Segéd record a profil frissítéséhez
    public record UpdateProfileRequest(String name, String phoneNumber) {}

    // =========================================================================
    // 11. SZEMÉLYES ADATOK (NÉV, TELEFON) FRISSÍTÉSE
    // =========================================================================
    @PutMapping("/me")
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public ResponseEntity<?> updateMyProfile(@RequestBody UpdateProfileRequest request, Principal principal) {
        try {
            User user = userRepository.findByEmail(principal.getName())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Felhasználó nem található"));

            user.setName(request.name());
            user.setPhoneNumber(request.phoneNumber());

            userRepository.save(user);

            return ResponseEntity.ok(Map.of("message", "Személyes adatok sikeresen frissítve!"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}