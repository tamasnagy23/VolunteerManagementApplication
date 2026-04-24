package com.example.volunteermanagement.service;

import com.example.volunteermanagement.tenant.TenantContext;
import com.example.volunteermanagement.model.AuditLog;
import com.example.volunteermanagement.model.Organization;
import com.example.volunteermanagement.repository.AuditLogRepository;
import com.example.volunteermanagement.repository.OrganizationRepository;
import com.example.volunteermanagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
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
    private final UserRepository userRepository;

    @Autowired
    @Lazy
    private AuditLogService self;

    // A régi metódust meghagyjuk, hogy a kód többi része ne törjön el
    public void logAction(String userEmail, String action, String target, String details, Long orgId) {
        logActionWithOrgName(userEmail, action, target, details, orgId, null);
    }

    // --- ÚJ METÓDUS: Ez fogadja az előre ismert szervezet nevet is ---
    public void logActionWithOrgName(String userEmail, String action, String target, String details, Long orgId, String knownOrgName) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            self.saveLogToMaster(userEmail, action, target, details, orgId, knownOrgName);
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    // --- JAVÍTVA: Ha megkapta a nevet (knownOrgName), nem keresi feleslegesen az adatbázisban ---
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveLogToMaster(String userEmail, String action, String target, String details, Long orgId, String knownOrgName) {
        String orgName = knownOrgName;

        // Csak akkor keresünk az adatbázisban, ha nem adtak meg előre nevet
        if (orgName == null && orgId != null) {
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

    public void logAccess(String userEmail, String action, String details, String uri) {
        Long orgId = null;

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

        if (orgId == null && !userEmail.equals("Vendég")) {
            String originalTenant = TenantContext.getCurrentTenant();
            try {
                TenantContext.clear();
                orgId = self.findUserOrgIdSafe(userEmail);
            } finally {
                TenantContext.setCurrentTenant(originalTenant);
            }
        }

        logAction(userEmail, action, "API Forgalom", details, orgId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public Long findUserOrgIdSafe(String userEmail) {
        var userOpt = userRepository.findByEmail(userEmail);
        if (userOpt.isPresent()) {
            var u = userOpt.get();
            if (u.getRole() != com.example.volunteermanagement.model.Role.SYS_ADMIN) {
                return u.getMemberships().stream()
                        .filter(m -> m.getStatus() == com.example.volunteermanagement.model.MembershipStatus.APPROVED &&
                                (m.getRole() == com.example.volunteermanagement.model.OrganizationRole.OWNER ||
                                        m.getRole() == com.example.volunteermanagement.model.OrganizationRole.ORGANIZER))
                        .map(m -> m.getOrganization().getId())
                        .findFirst()
                        .orElse(null);
            }
        }
        return null;
    }

    @Transactional(readOnly = true)
    public List<AuditLog> getAllLogs() {
        return auditLogRepository.findAllByOrderByTimestampDesc();
    }
}