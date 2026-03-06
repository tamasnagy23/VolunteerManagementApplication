package com.example.volunteermanagement.service;

import com.example.volunteermanagement.model.AuditLog;
import com.example.volunteermanagement.model.Organization;
import com.example.volunteermanagement.repository.AuditLogRepository;
import com.example.volunteermanagement.repository.OrganizationRepository;
import com.example.volunteermanagement.repository.UserRepository; // <-- ÚJ IMPORT
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository; // <-- BE KELL INJEKTÁLNI A USER REPOSITOT!

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAction(String userEmail, String action, String target, String details, Long orgId) {
        String orgName = null;
        if (orgId != null) {
            orgName = organizationRepository.findById(orgId)
                    .map(Organization::getName)
                    .orElse("Ismeretlen szervezet");
        }

        AuditLog log = AuditLog.builder()
                .timestamp(LocalDateTime.now())
                .userEmail(userEmail)
                .action(action)
                .target(target)
                .details(details)
                .organizationId(orgId)
                .organizationName(orgName)
                .build();
        auditLogRepository.save(log);
    }

    // --- ÚJ METÓDUS: Ez kezeli a Filterből érkező megtekintéseket! ---
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAccess(String userEmail, String action, String details, String uri) {
        Long orgId = null;

        // 1. URL-ből kinyerés
        if (uri.contains("/organizations/")) {
            try {
                String[] parts = uri.split("/");
                for (int i = 0; i < parts.length; i++) {
                    if (parts[i].equals("organizations") && i + 1 < parts.length) {
                        orgId = Long.parseLong(parts[i + 1]);
                        break;
                    }
                }
            } catch (NumberFormatException ignored) {}
        }

        // 2. Ha nincs orgId, akkor kikeressük a felhasználó alapján (Itt már biztonságos az adatbázis hívás!)
        if (orgId == null && !userEmail.equals("Vendég")) {
            var userOpt = userRepository.findByEmail(userEmail);
            if (userOpt.isPresent()) {
                var u = userOpt.get();
                if (u.getRole() != com.example.volunteermanagement.model.Role.SYS_ADMIN) {
                    orgId = u.getMemberships().stream()
                            .filter(m -> m.getStatus() == com.example.volunteermanagement.model.MembershipStatus.APPROVED &&
                                    (m.getRole() == com.example.volunteermanagement.model.OrganizationRole.OWNER ||
                                            m.getRole() == com.example.volunteermanagement.model.OrganizationRole.ORGANIZER))
                            .map(m -> m.getOrganization().getId())
                            .findFirst()
                            .orElse(null);
                }
            }
        }

        // Továbbadjuk a fő mentő metódusnak
        logAction(userEmail, action, "API Forgalom", details, orgId);
    }

    public List<AuditLog> getAllLogs() {
        return auditLogRepository.findAllByOrderByTimestampDesc();
    }
}