package com.example.volunteermanagement.service;

import com.example.volunteermanagement.tenant.TenantContext;
import com.example.volunteermanagement.dto.StatisticsDTO.EventStatsDTO;
import com.example.volunteermanagement.dto.StatisticsDTO.MyStatsDTO;
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

    @Autowired
    @Lazy
    private StatisticsService self;

    @Transactional(readOnly = true)
    public MyStatsDTO getMyStatistics(String email) {
        User user = userRepository.findByEmail(email).orElseThrow();

        // 1. Megkeressük az összes szervezetet, amihez a felhasználó tartozik
        List<Organization> userOrgs;
        if (user.getRole() == Role.SYS_ADMIN) {
            userOrgs = organizationRepository.findAll();
        } else {
            userOrgs = user.getMemberships().stream()
                    .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                    .map(OrganizationMember::getOrganization)
                    .collect(Collectors.toList());
        }

        long totalCompleted = 0;
        long totalUpcoming = 0;
        double totalHours = 0.0;

        String originalTenant = TenantContext.getCurrentTenant();

        try {
            // 2. Globális tér lekérdezése
            TenantContext.setCurrentTenant(null);
            MyStatsDTO globalStats = self.calculateStatsForTenant(user);
            totalCompleted += globalStats.completedShifts();
            totalUpcoming += globalStats.upcomingShifts();
            totalHours += globalStats.totalHoursWorked(); // JAVÍTVA

            // 3. Végigiterálunk a Szervezeteken és összeadjuk a statisztikákat
            for (Organization org : userOrgs) {
                if (org.getTenantId() != null && !org.getTenantId().trim().isEmpty()) {
                    TenantContext.setCurrentTenant(org.getTenantId());

                    MyStatsDTO tenantStats = self.calculateStatsForTenant(user);
                    totalCompleted += tenantStats.completedShifts();
                    totalUpcoming += tenantStats.upcomingShifts();
                    totalHours += tenantStats.totalHoursWorked(); // JAVÍTVA
                }
            }
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }

        // Kerekítés 1 tizedesjegyre a legvégén
        totalHours = Math.round(totalHours * 10.0) / 10.0;

        return new MyStatsDTO(totalCompleted, totalHours, totalUpcoming);
    }

    // ÚJ METÓDUS: Ez végzi a tényleges számolást egy adott adatbázison belül
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public MyStatsDTO calculateStatsForTenant(User user) {
        List<ShiftAssignment> assignments = shiftAssignmentRepository.findByUserId(user.getId());

        long completed = 0;
        long upcoming = 0;
        double hours = 0;
        LocalDateTime now = LocalDateTime.now();

        for (ShiftAssignment assignment : assignments) {
            Shift shift = assignment.getShift();
            // Kizárjuk a személyes elfoglaltságokat a statisztikából!
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
    public EventStatsDTO getEventStatistics(Long eventId) {
        // Elfogadott önkéntesek száma
        List<Application> approvedApps = applicationRepository.findByEventId(eventId).stream()
                .filter(app -> app.getStatus() == ApplicationStatus.APPROVED)
                .toList();

        long totalVolunteers = approvedApps.size();

        // Műszakok statisztikája
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

        // Munkaterületek népszerűsége (Hányan jelentkeztek egy adott területre)
        Map<String, Long> areaStats = new HashMap<>();
        for (Application app : approvedApps) {
            if (app.getAssignedWorkArea() != null) {
                String areaName = app.getAssignedWorkArea().getName();
                areaStats.put(areaName, areaStats.getOrDefault(areaName, 0L) + 1);
            }
        }

        return new EventStatsDTO(totalVolunteers, totalShifts, fullShifts, areaStats);
    }
}