package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.tenant.TenantContext;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.AuditLogRepository;
import com.example.volunteermanagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<AuditLog>> getLogs(Principal principal) {

        // 1. Mentsük el a jelenlegi tenantot (amit a frontend küldött)
        String originalTenant = TenantContext.getCurrentTenant();

        try {
            // 2. ERŐSZAKOS VÁLTÁS A MESTER ADATBÁZISRA: A naplók és a felhasználók csak itt vannak egyben!
            TenantContext.setCurrentTenant(null);

            User user = userRepository.findByEmail(principal.getName()).orElseThrow();

            // 3. Ha Rendszergazda: Mindent lát a mester adatbázisból
            if (user.getRole() == Role.SYS_ADMIN) {
                return ResponseEntity.ok(auditLogRepository.findAllByOrderByTimestampDesc());
            }

            // 4. Ha Szervező/Tulajdonos: Kigyűjtjük, hogy mely szervezetekhez van joga
            List<Long> myOrgIds = user.getMemberships().stream()
                    .filter(m -> m.getStatus() == MembershipStatus.APPROVED &&
                            (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER))
                    .map(m -> m.getOrganization().getId())
                    .collect(Collectors.toList());

            if (myOrgIds.isEmpty()) {
                return ResponseEntity.status(403).build(); // Nincs joga látni semmit (Frontend lekezeli!)
            }

            // 5. Csak a saját szervezeteihez tartozó logokat küldjük ki
            return ResponseEntity.ok(auditLogRepository.findByOrganizationIdInOrderByTimestampDesc(myOrgIds));

        } finally {
            // 6. Állítsuk vissza a kontextust a lekérdezés után, hogy ne rondítsunk bele másba
            TenantContext.setCurrentTenant(originalTenant);
        }
    }
}