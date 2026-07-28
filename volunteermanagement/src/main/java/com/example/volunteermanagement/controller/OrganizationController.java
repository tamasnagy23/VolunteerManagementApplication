package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.config.JwtService;
import com.example.volunteermanagement.dto.OrganizationDTO;
import com.example.volunteermanagement.dto.PendingApplicationDTO;
import com.example.volunteermanagement.model.MembershipStatus;
import com.example.volunteermanagement.model.Organization;
import com.example.volunteermanagement.model.OrganizationRole;
import com.example.volunteermanagement.model.Role;
import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.repository.OrganizationRepository;
import com.example.volunteermanagement.repository.UserRepository;
import com.example.volunteermanagement.service.FileStorageService;
import com.example.volunteermanagement.service.OrganizationService;
import com.example.volunteermanagement.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/organizations")
@RequiredArgsConstructor
public class OrganizationController {

    private final OrganizationService organizationService;
    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final FileStorageService fileStorageService;
    @Autowired
    private final JwtService jwtService;

    @GetMapping
    public ResponseEntity<List<OrganizationDTO>> getAllOrganizations() {
        return ResponseEntity.ok(organizationService.getAllOrganizations());
    }

    @PostMapping("/{id}/join")
    public ResponseEntity<String> joinOrganization(@PathVariable Long id, Authentication authentication) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            organizationService.joinOrganization(id, authentication.getName());
            return ResponseEntity.ok("Sikeresen jelentkeztél a szervezetbe!");
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @PutMapping("/{membershipId}/handle")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> handleApplication(
            @PathVariable Long membershipId,
            @RequestParam String status,
            @RequestParam(required = false) String rejectionMessage,
            Principal principal) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            organizationService.handleApplication(membershipId, status, rejectionMessage, principal.getName());
            return ResponseEntity.ok("Jelentkezés állapota frissítve.");
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @PutMapping("/{orgId}/members/{userId}/role")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> updateMemberRole(
            @PathVariable Long orgId, @PathVariable Long userId,
            @RequestParam OrganizationRole role, Principal principal) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            organizationService.updateMemberRole(orgId, userId, role, principal.getName());
            return ResponseEntity.ok("Szerepkör sikeresen módosítva.");
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @DeleteMapping("/{orgId}/leave")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> leaveOrganization(@PathVariable Long orgId, Principal principal) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            organizationService.leaveOrganization(orgId, principal.getName());
            return ResponseEntity.ok("Sikeresen kiléptél.");
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @DeleteMapping("/{orgId}/members/{userId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> removeMember(
            @PathVariable Long orgId,
            @PathVariable Long userId,
            Principal principal,
            @RequestParam(required = false) String reason) {

        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            organizationService.removeMember(orgId, userId, principal.getName(), reason);
            return ResponseEntity.ok("Tag eltávolítva.");
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @GetMapping("/applications/pending")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<PendingApplicationDTO>> getPendingApplications(
            @RequestParam(required = false) Long orgId,
            Principal principal) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            return ResponseEntity.ok(organizationService.getPendingApplications(principal.getName(), orgId));
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @GetMapping("/applications/history")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<PendingApplicationDTO>> getHistory(
            @RequestParam(required = false) Long orgId,
            Principal principal) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            return ResponseEntity.ok(organizationService.getHistory(principal.getName(), orgId));
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrganizationDTO> getOrganizationById(@PathVariable Long id) {
        return ResponseEntity.ok(organizationService.getOrganizationById(id));
    }

    // =========================================================================
    // LOGÓ FELTÖLTÉSE / TÖRLÉSE
    // =========================================================================
    @PostMapping("/{id}/logo")
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public ResponseEntity<?> uploadOrganizationLogo(@PathVariable Long id, @RequestParam("file") MultipartFile file, Principal principal) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();

            User user = userRepository.findByEmail(principal.getName())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Felhasználó nem található"));

            Organization org = organizationRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Szervezet nem található"));

            boolean isSysAdmin = user.getRole() == Role.SYS_ADMIN;
            boolean isLeader = user.getMemberships().stream()
                    .anyMatch(m -> m.getOrganization().getId().equals(id) &&
                            m.getStatus() == MembershipStatus.APPROVED &&
                            (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER));

            if (!isSysAdmin && !isLeader) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Nincs jogosultságod a szervezet logójának módosításához!"));
            }

            String fileUrl = fileStorageService.storeFile(file, "logos");
            org.setLogoUrl(fileUrl);
            organizationRepository.save(org);

            return ResponseEntity.ok(Map.of("message", "Szervezeti logó sikeresen frissítve!", "imageUrl", fileUrl));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @DeleteMapping("/{id}/logo")
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public ResponseEntity<?> deleteOrganizationLogo(@PathVariable Long id, Principal principal) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            User user = userRepository.findByEmail(principal.getName()).orElseThrow();
            Organization org = organizationRepository.findById(id).orElseThrow();

            boolean isSysAdmin = user.getRole() == Role.SYS_ADMIN;
            boolean isLeader = user.getMemberships().stream()
                    .anyMatch(m -> m.getOrganization().getId().equals(id) &&
                            m.getStatus() == MembershipStatus.APPROVED &&
                            (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER));

            if (!isSysAdmin && !isLeader) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Nincs jogosultságod a szervezet logójának törléséhez!"));
            }

            org.setLogoUrl(null);
            organizationRepository.save(org);

            return ResponseEntity.ok(Map.of("message", "Szervezeti logó sikeresen törölve!"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    // =========================================================================
    // BORÍTÓKÉP (BANNER) FELTÖLTÉSE / TÖRLÉSE
    // =========================================================================
    @PostMapping("/{id}/banner")
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public ResponseEntity<?> uploadOrganizationBanner(@PathVariable Long id, @RequestParam("file") MultipartFile file, Principal principal) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();

            User user = userRepository.findByEmail(principal.getName())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Felhasználó nem található"));

            Organization org = organizationRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Szervezet nem található"));

            boolean isSysAdmin = user.getRole() == Role.SYS_ADMIN;
            boolean isLeader = user.getMemberships().stream()
                    .anyMatch(m -> m.getOrganization().getId().equals(id) &&
                            m.getStatus() == MembershipStatus.APPROVED &&
                            (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER));

            if (!isSysAdmin && !isLeader) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Nincs jogosultságod a szervezet borítóképének módosításához!"));
            }

            String fileUrl = fileStorageService.storeFile(file, "banners");
            org.setBannerUrl(fileUrl);
            organizationRepository.save(org);

            return ResponseEntity.ok(Map.of("message", "Szervezeti borítókép sikeresen frissítve!", "imageUrl", fileUrl));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @DeleteMapping("/{id}/banner")
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public ResponseEntity<?> deleteOrganizationBanner(@PathVariable Long id, Principal principal) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            User user = userRepository.findByEmail(principal.getName()).orElseThrow();
            Organization org = organizationRepository.findById(id).orElseThrow();

            boolean isSysAdmin = user.getRole() == Role.SYS_ADMIN;
            boolean isLeader = user.getMemberships().stream()
                    .anyMatch(m -> m.getOrganization().getId().equals(id) &&
                            m.getStatus() == MembershipStatus.APPROVED &&
                            (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER));

            if (!isSysAdmin && !isLeader) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Nincs jogosultságod a szervezet borítóképének törléséhez!"));
            }

            org.setBannerUrl(null);
            organizationRepository.save(org);

            return ResponseEntity.ok(Map.of("message", "Szervezeti borítókép sikeresen törölve!"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> updateOrganization(@PathVariable Long id, @RequestBody OrganizationDTO dto, Principal principal) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            organizationService.updateOrganizationDetails(id, dto, principal.getName());
            return ResponseEntity.ok(Map.of("message", "A szervezet adatai sikeresen frissítve!"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @PutMapping("/memberships/{membershipId}/restore")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> restoreMember(
            @PathVariable Long membershipId,
            Principal principal) {

        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            organizationService.restoreMember(membershipId, principal.getName());
            return ResponseEntity.ok(Map.of("message", "Felhasználó sikeresen visszaállítva az Aktív tagok közé."));
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    // =========================================================================
    // SZERVEZET LÉTREHOZÁSA MEGLÉVŐ FELHASZNÁLÓNAK (DÖNTÉSHOZÓ PARAMÉTERREL)
    // =========================================================================
    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> createOrganization(
            @RequestBody OrganizationDTO dto,
            @RequestParam(required = false) Boolean forceCreateNew,
            Principal principal) {

        // 1. Létrehozzuk/visszaállítjuk a szervezetet a service-ben
        OrganizationDTO createdOrg = organizationService.createOrganization(dto, principal.getName(), forceCreateNew);

        // 2. Kikérjük a frissített felhasználót a módosult tagságokkal a Master DB-ből
        User user = userRepository.findByEmail(principal.getName()).orElseThrow();

        // 3. Generálunk egy vadonatúj JWT tokent a friss claims-ekkel
        String freshToken = jwtService.generateToken(user);

        // 4. Visszaküldjük mindkettőt egy Map-ben
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "organization", createdOrg,
                "token", freshToken
        ));
    }

    // =========================================================================
    // SZERVEZET TÖRLÉSE (SOFT DELETE) FRISSÍTETT TOKENNEL
    // =========================================================================
    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> deleteOrganization(@PathVariable Long id, Principal principal) {
        // 1. Logikai törlés végrehajtása
        organizationService.softDeleteOrganization(id, principal.getName());

        // 2. Felhasználó kikérése a frissített tagságokkal
        User user = userRepository.findByEmail(principal.getName()).orElseThrow();

        // 3. Új JWT token generálása (amiben már nincs benne az OWNER jog ehhez a szervezethez)
        String freshToken = jwtService.generateToken(user);

        // 4. Visszaküldjük a sikeres üzenetet ÉS az új tokent
        return ResponseEntity.ok(Map.of(
                "message", "A szervezet sikeresen törölve lett.",
                "token", freshToken
        ));
    }
}