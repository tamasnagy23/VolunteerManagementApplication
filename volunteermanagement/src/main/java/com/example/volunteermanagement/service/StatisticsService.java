package com.example.volunteermanagement.service;

import com.example.volunteermanagement.tenant.TenantContext;
import com.example.volunteermanagement.dto.EventStatsDTO;
import com.example.volunteermanagement.dto.MyStatsDTO;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StatisticsService {

    private final UserRepository userRepository;
    private final ShiftAssignmentRepository shiftAssignmentRepository;
    private final ApplicationRepository applicationRepository;
    private final ShiftRepository shiftRepository;
    private final OrganizationRepository organizationRepository;
    private final EventRepository eventRepository;

    @Autowired
    @Lazy
    private StatisticsService self;

    @Transactional(readOnly = true)
    public MyStatsDTO getMyStatistics(String email) {
        User user = userRepository.findByEmail(email).orElseThrow();

        List<Organization> userOrgs;
        if (user.getRole() == Role.SYS_ADMIN) {
            userOrgs = organizationRepository.findAll();
        } else {
            userOrgs = user.getMemberships().stream()
                    .filter(m -> m.getOrganization() != null && m.getStatus() == MembershipStatus.APPROVED)
                    .map(OrganizationMember::getOrganization)
                    .collect(Collectors.toList());
        }

        long totalCompleted = 0;
        long totalUpcoming = 0;
        double totalHours = 0.0;

        String originalTenant = TenantContext.getCurrentTenant();

        try {
            TenantContext.setCurrentTenant(null);
            MyStatsDTO globalStats = self.calculateStatsForTenant(user);
            totalCompleted += globalStats.completedShifts();
            totalUpcoming += globalStats.upcomingShifts();
            totalHours += globalStats.totalHoursWorked();

            for (Organization org : userOrgs) {
                if (org.getTenantId() != null && !org.getTenantId().trim().isEmpty()) {
                    TenantContext.setCurrentTenant(org.getTenantId());

                    MyStatsDTO tenantStats = self.calculateStatsForTenant(user);
                    totalCompleted += tenantStats.completedShifts();
                    totalUpcoming += tenantStats.upcomingShifts();
                    totalHours += tenantStats.totalHoursWorked();
                }
            }
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }

        totalHours = Math.round(totalHours * 10.0) / 10.0;

        return new MyStatsDTO(totalCompleted, totalHours, totalUpcoming);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public MyStatsDTO calculateStatsForTenant(User user) {
        List<ShiftAssignment> assignments = shiftAssignmentRepository.findByUserId(user.getId());

        long completed = 0;
        long upcoming = 0;
        double hours = 0;
        LocalDateTime now = LocalDateTime.now();

        for (ShiftAssignment assignment : assignments) {
            Shift shift = assignment.getShift();
            if (assignment.getStatus() == AssignmentStatus.CONFIRMED && shift.getType() != ShiftType.PERSONAL) {
                if (shift.getEndTime().isBefore(now)) {
                    completed++;
                    long minutes = Duration.between(shift.getStartTime(), shift.getEndTime()).toMinutes();
                    hours += (minutes / 60.0);
                } else {
                    upcoming++;
                }
            }
        }
        return new MyStatsDTO(completed, hours, upcoming);
    }

    @Transactional(readOnly = true)
    public EventStatsDTO getEventStatistics(Long eventId, String requesterEmail) {
        String originalTenant = TenantContext.getCurrentTenant();

        try {
            // 1. Megkeressük az eseményt a Mester adatbázisban
            TenantContext.setCurrentTenant(null);

            Event event = eventRepository.findById(eventId)
                    .orElseThrow(() -> new RuntimeException("Esemény nem található a Mester adatbázisban!"));

            Organization org = event.getOrganization();

            // =====================================================================
            // ÚJ: BIZTONSÁGI ELLENŐRZÉS (PORTÁS)
            // =====================================================================
            User user = userRepository.findByEmail(requesterEmail).orElseThrow();
            boolean isSysAdmin = user.getRole() == Role.SYS_ADMIN;
            boolean hasAccess = false;

            if (org != null) {
                hasAccess = user.getMemberships().stream()
                        .filter(m -> m.getOrganization() != null)
                        .anyMatch(m -> m.getOrganization().getId().equals(org.getId()) &&
                                m.getStatus() == MembershipStatus.APPROVED &&
                                (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER));
            }

            // Ha nem Rendszergazda és nincs vezetői joga a szervezethez, kidobjuk!
            if (!isSysAdmin && !hasAccess) {
                throw new RuntimeException("Nincs jogosultságod lekérdezni ennek az eseménynek a statisztikáit!");
            }
            // =====================================================================

            // 2. Ha van saját Tenantja, átugrunk oda!
            if (org != null && org.getTenantId() != null && !org.getTenantId().trim().isEmpty()) {
                TenantContext.setCurrentTenant(org.getTenantId());
                return self.fetchEventStatsInTenant(eventId);
            }

            return self.fetchEventStatsInTenant(eventId);

        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public EventStatsDTO fetchEventStatsInTenant(Long eventId) {
        List<Application> approvedApps = applicationRepository.findByEventId(eventId).stream()
                .filter(app -> app.getStatus() == ApplicationStatus.APPROVED)
                .toList();

        long totalVolunteers = approvedApps.size();

        List<Shift> eventShifts = shiftRepository.findByEventId(eventId).stream()
                .filter(s -> s.getType() == ShiftType.WORK)
                .toList();

        long totalShifts = eventShifts.size();
        long fullShifts = eventShifts.stream().filter(s -> {
            long confirmedCount = s.getAssignments().stream()
                    .filter(a -> !a.isBackup() && a.getStatus() == AssignmentStatus.CONFIRMED)
                    .count();
            return confirmedCount >= s.getMaxVolunteers();
        }).count();

        Map<String, Long> areaStats = new HashMap<>();
        for (Application app : approvedApps) {
            if (app.getAssignedWorkArea() != null) {
                String areaName = app.getAssignedWorkArea().getName();
                areaStats.put(areaName, areaStats.getOrDefault(areaName, 0L) + 1);
            }
        }

        return new EventStatsDTO(totalVolunteers, totalShifts, fullShifts, areaStats);
    }

    // =========================================================================
    // ÚJ: Jogosultság-alapú eseménylista lekérdezése
    // =========================================================================
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getManagedEvents(String requesterEmail) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            // A Mester DB-ben dolgozunk, mert ott vannak a szervezetek és az események alapadatai
            TenantContext.setCurrentTenant(null);

            User user = userRepository.findByEmail(requesterEmail).orElseThrow();
            boolean isSysAdmin = user.getRole() == Role.SYS_ADMIN;

            // 1. Összegyűjtjük az engedélyezett Szervezet ID-kat
            List<Long> allowedOrgIds;
            if (isSysAdmin) {
                allowedOrgIds = organizationRepository.findAll().stream()
                        .map(Organization::getId)
                        .collect(Collectors.toList());
            } else {
                allowedOrgIds = user.getMemberships().stream()
                        .filter(m -> m.getOrganization() != null && m.getStatus() == MembershipStatus.APPROVED &&
                                (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER))
                        .map(m -> m.getOrganization().getId())
                        .collect(Collectors.toList());
            }

            if (allowedOrgIds.isEmpty()) return List.of(); // Ha nincs jogosultsága, üres listát kap

            // 2. Kikeressük az eseményeket, és csak a legszükségesebb adatokat küldjük a Frontendnek (ID és Cím)
            return eventRepository.findAll().stream()
                    .filter(e -> e.getOrganization() != null && allowedOrgIds.contains(e.getOrganization().getId()))
                    .map(e -> {
                        // Explicit módon létrehozunk egy HashMap-et Object értékekkel
                        Map<String, Object> map = new java.util.HashMap<>();
                        map.put("id", e.getId());
                        map.put("title", e.getTitle());
                        return map;
                    })
                    .collect(Collectors.toList());

        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }
}