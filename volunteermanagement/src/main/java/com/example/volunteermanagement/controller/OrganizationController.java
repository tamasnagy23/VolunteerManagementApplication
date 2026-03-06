package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.OrganizationDTO;
import com.example.volunteermanagement.dto.PendingApplicationDTO;
import com.example.volunteermanagement.model.OrganizationRole;
import com.example.volunteermanagement.service.OrganizationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/organizations")
@RequiredArgsConstructor
public class OrganizationController {

    private final OrganizationService organizationService;

    @GetMapping
    public ResponseEntity<List<OrganizationDTO>> getAllOrganizations() {
        return ResponseEntity.ok(organizationService.getAllOrganizations());
    }

    @PostMapping("/{id}/join")
    public ResponseEntity<String> joinOrganization(@PathVariable Long id, Authentication authentication) {
        organizationService.joinOrganization(id, authentication.getName());
        return ResponseEntity.ok("Sikeresen jelentkeztél a szervezetbe!");
    }

    @PutMapping("/{membershipId}/handle")
    @PreAuthorize("hasAnyRole('SYS_ADMIN', 'ORGANIZER', 'OWNER')")
    public ResponseEntity<?> handleApplication(
            @PathVariable Long membershipId,
            @RequestParam String status,
            @RequestParam(required = false) String rejectionMessage,
            Principal principal) {
        organizationService.handleApplication(membershipId, status, rejectionMessage, principal.getName());
        return ResponseEntity.ok("Jelentkezés állapota frissítve.");
    }

    // --- ÚJ: SZEREPKÖR MÓDOSÍTÁSA ---
    @PutMapping("/{orgId}/members/{userId}/role")
    @PreAuthorize("hasAnyRole('SYS_ADMIN', 'OWNER', 'ORGANIZER')")
    public ResponseEntity<?> updateMemberRole(
            @PathVariable Long orgId,
            @PathVariable Long userId,
            @RequestParam OrganizationRole role,
            Principal principal) {
        organizationService.updateMemberRole(orgId, userId, role, principal.getName());
        return ResponseEntity.ok("Szerepkör sikeresen módosítva.");
    }

    @DeleteMapping("/{orgId}/leave")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> leaveOrganization(@PathVariable Long orgId, Principal principal) {
        organizationService.leaveOrganization(orgId, principal.getName());
        return ResponseEntity.ok("Sikeresen kiléptél.");
    }

    @DeleteMapping("/{orgId}/members/{userId}")
    @PreAuthorize("hasAnyRole('SYS_ADMIN', 'ORGANIZER', 'OWNER')")
    public ResponseEntity<?> removeMember(@PathVariable Long orgId, @PathVariable Long userId, Principal principal) {
        organizationService.removeMember(orgId, userId, principal.getName());
        return ResponseEntity.ok("Tag eltávolítva.");
    }

    @GetMapping("/applications/pending")
    public ResponseEntity<List<PendingApplicationDTO>> getPendingApplications(Principal principal) {
        return ResponseEntity.ok(organizationService.getPendingApplications(principal.getName()));
    }

    @GetMapping("/applications/history")
    public ResponseEntity<List<PendingApplicationDTO>> getHistory(Principal principal) {
        return ResponseEntity.ok(organizationService.getHistory(principal.getName()));
    }
}