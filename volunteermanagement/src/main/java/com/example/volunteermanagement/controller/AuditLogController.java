package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.AuditLogRepository;
import com.example.volunteermanagement.repository.UserRepository;
import com.example.volunteermanagement.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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

    private final AuditLogService auditLogService;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;

    // Csak Rendszergazdák láthatják a teljes rendszernaplót!
    @GetMapping
    public ResponseEntity<List<AuditLog>> getLogs(Principal principal) {
        User user = userRepository.findByEmail(principal.getName()).orElseThrow();

        // 1. Ha Rendszergazda: Mindent lát
        if (user.getRole() == Role.SYS_ADMIN) {
            return ResponseEntity.ok(auditLogService.getAllLogs());
        }

        // 2. Ha Szervező/Alapító: Csak a saját szervezeteit látja
        List<Long> myOrgIds = user.getMemberships().stream()
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED &&
                        (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER))
                .map(m -> m.getOrganization().getId())
                .collect(Collectors.toList());

        if (myOrgIds.isEmpty()) {
            return ResponseEntity.status(403).build(); // Nincs joga látni semmit
        }

        // Csak a saját szervezeteihez tartozó logokat küldjük ki
        return ResponseEntity.ok(auditLogRepository.findByOrganizationIdInOrderByTimestampDesc(myOrgIds));
    }
}