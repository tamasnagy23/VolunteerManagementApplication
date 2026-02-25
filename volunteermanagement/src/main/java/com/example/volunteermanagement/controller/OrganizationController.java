package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.OrganizationDTO;
import com.example.volunteermanagement.dto.PendingApplicationDTO;
import com.example.volunteermanagement.service.OrganizationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/organizations")
@RequiredArgsConstructor
public class OrganizationController {

    private final OrganizationService organizationService;

    // GET /api/organizations -> Visszaadja a listát
    @GetMapping
    public ResponseEntity<List<OrganizationDTO>> getAllOrganizations() {
        return ResponseEntity.ok(organizationService.getAllOrganizations());
    }

    // POST /api/organizations/1/join -> Jelentkezés az 1-es ID-jú szervezetbe
    @PostMapping("/{id}/join")
    public ResponseEntity<String> joinOrganization(
            @PathVariable Long id,
            Authentication authentication
    ) {
        // A bejelentkezett felhasználó email címét a Spring Security-ből szedjük ki
        organizationService.joinOrganization(id, authentication.getName());
        return ResponseEntity.ok("Sikeresen jelentkeztél a szervezetbe! Várj a jóváhagyásra.");
    }

    @GetMapping("/applications/pending")
    public ResponseEntity<List<PendingApplicationDTO>> getPendingApplications(Principal principal) {
        return ResponseEntity.ok(organizationService.getPendingApplications(principal.getName()));
    }

    @PutMapping("/applications/{id}")
    public ResponseEntity<Void> handleApplication(@PathVariable Long id, @RequestParam String status) {
        organizationService.handleApplication(id, status);
        return ResponseEntity.ok().build();
    }
}