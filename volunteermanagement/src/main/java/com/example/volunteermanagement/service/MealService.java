package com.example.volunteermanagement.service;

import com.example.volunteermanagement.dto.CateringDTO;
import com.example.volunteermanagement.tenant.TenantContext;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MealService {

    private final MealConsumptionLogRepository mealLogRepository;
    private final ShiftAssignmentRepository shiftAssignmentRepository;
    private final UserRepository userRepository;
    private final EventRepository eventRepository;
    private final EventTeamMemberRepository eventTeamMemberRepository;
    private final ApplicationRepository applicationRepository;
    private final OrganizationRepository organizationRepository;
    private final ApplicationAnswerRepository applicationAnswerRepository;
    private final EventQuestionRepository eventQuestionRepository;

    @Autowired
    @Lazy
    private MealService self;

    // =========================================================================
    // KARMESTER METÓDUS (Tenant útválasztás - Ahogy a statisztikában is van!)
    // =========================================================================
    public Map<String, Object> routeAndProcessQrScan(Long volunteerId, Long eventId, String scannerEmail, MealType mealType) {
        String originalTenant = TenantContext.getCurrentTenant();

        try {
            // 1. Átváltunk a Master adatbázisra, hogy biztosan megtaláljuk az Eseményt
            TenantContext.setCurrentTenant(null);

            Event event = eventRepository.findById(eventId)
                    .orElseThrow(() -> new RuntimeException("Esemény nem található a Mester adatbázisban!"));

            Organization org = event.getOrganization();

            // 2. Ha az eseményhez tartozó szervezetnek van saját Tenant adatbázisa, átkapcsolunk arra!
            if (org != null && org.getTenantId() != null && !org.getTenantId().trim().isEmpty()) {
                TenantContext.setCurrentTenant(org.getTenantId());
            }

            // 3. A helyes Tenanton állva elindítjuk a tényleges szkennelést egy ÚJ tranzakcióban!
            return self.processQrScanInTenant(volunteerId, eventId, scannerEmail, mealType);

        } finally {
            // Visszaállítjuk az eredeti állapotot, hogy más API kéréseket ne zavarjunk
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    // =========================================================================
    // FELDOLGOZÓ METÓDUS (A tényleges mentés a már beállított adatbázisban)
    // =========================================================================
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Map<String, Object> processQrScanInTenant(Long volunteerId, Long eventId, String scannerEmail, MealType mealType) {

        User volunteer = userRepository.findById(volunteerId)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található!"));
        User scanner = userRepository.findByEmail(scannerEmail)
                .orElseThrow(() -> new RuntimeException("Szkenner felhasználó nem található!"));
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Esemény nem található!"));

        boolean isSysAdmin = scanner.getRole() != null && scanner.getRole().name().equals("SYS_ADMIN");

        Optional<EventTeamMember> scannerMembership = eventTeamMemberRepository.findByEventId(eventId).stream()
                .filter(tm -> tm.getUserId().equals(scanner.getId()))
                .findFirst();

        boolean hasEventPermission = scannerMembership.isPresent() &&
                (scannerMembership.get().getRole() == EventRole.ORGANIZER ||
                        scannerMembership.get().getRole() == EventRole.COORDINATOR ||
                        scannerMembership.get().getRole() == EventRole.MEAL_SCANNER);

        if (!isSysAdmin && !hasEventPermission) {
            return Map.of("success", false, "message", "Nincs jogosultságod ételt osztani ezen az eseményen!");
        }

        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = LocalDate.now().atTime(LocalTime.MAX);

        int allowanceForThisMealType = 0;

        Optional<EventTeamMember> teamMembership = eventTeamMemberRepository.findByEventId(eventId).stream()
                .filter(tm -> tm.getUserId().equals(volunteerId))
                .findFirst();

        if (teamMembership.isPresent() &&
                (teamMembership.get().getRole() == EventRole.ORGANIZER || teamMembership.get().getRole() == EventRole.COORDINATOR)) {
            allowanceForThisMealType = 1; // Szervezőknek végtelenített is lehet, de most napi 1-re van állítva
        } else {
            if (mealType == MealType.BREAKFAST) {
                allowanceForThisMealType = shiftAssignmentRepository.sumBreakfastsForUserToday(
                        volunteerId, eventId, startOfDay, endOfDay, AssignmentStatus.CONFIRMED);
            } else if (mealType == MealType.LUNCH) {
                allowanceForThisMealType = shiftAssignmentRepository.sumLunchesForUserToday(
                        volunteerId, eventId, startOfDay, endOfDay, AssignmentStatus.CONFIRMED);
            } else if (mealType == MealType.DINNER) {
                allowanceForThisMealType = shiftAssignmentRepository.sumDinnersForUserToday(
                        volunteerId, eventId, startOfDay, endOfDay, AssignmentStatus.CONFIRMED);
            }
        }

        String mealName = translateMealType(mealType);

        if (allowanceForThisMealType == 0) {
            return Map.of("success", false, "message", "Ma nincs olyan beosztásod, amihez " + mealName + " járna.");
        }

        long consumedTodayOfThisType = mealLogRepository.countMealsConsumedTodayByType(
                volunteerId, eventId, mealType, startOfDay, endOfDay);

        if (consumedTodayOfThisType >= allowanceForThisMealType) {
            // --- ÚJ: Megkeressük a legutóbbi kiadás idejét ---
            Optional<MealConsumptionLog> lastLog = mealLogRepository.findFirstByVolunteerIdAndEventIdAndMealTypeAndConsumedAtBetweenOrderByConsumedAtDesc(
                    volunteerId, eventId, mealType, startOfDay, endOfDay);

            String timeStr = lastLog.map(log -> log.getConsumedAt().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")))
                    .orElse("ismeretlen időpontban");

            return Map.of("success", false, "message", "A mai " + mealName + " keretedet (" + allowanceForThisMealType + "/" + allowanceForThisMealType + ") már teljesen felhasználtad!\n(Legutóbb kiadva: " + timeStr + ")");
        }

        String dietaryPref = getDietaryPreference(volunteer, event);

        MealConsumptionLog log = MealConsumptionLog.builder()
                .volunteer(volunteer)
                .event(event)
                .scannedBy(scanner)
                .mealType(mealType)
                .consumedAt(LocalDateTime.now())
                .dietaryPreference(dietaryPref)
                .build();

        mealLogRepository.save(log);

        return Map.of(
                "success", true,
                "message", "Sikeres csekkolás! Jó étvágyat a(z) " + mealName + "hoz! (" + (consumedTodayOfThisType + 1) + "/" + allowanceForThisMealType + ")",
                "dietaryPreference", dietaryPref
        );
    }

    private String getDietaryPreference(User volunteer, Event event) {
        Optional<Application> appOpt = applicationRepository.findByUserIdAndEventId(volunteer.getId(), event.getId())
                .stream().findFirst();

        if (appOpt.isPresent()) {
            Application app = appOpt.get();

            for (ApplicationAnswer answer : app.getAnswers()) {
                String questionText = answer.getQuestion().getQuestionText().toLowerCase();

                if (questionText.contains("étkezés") ||
                        questionText.contains("menü") ||
                        questionText.contains("diéta") ||
                        questionText.contains("allergia") ||
                        questionText.contains("érzékenység")) {

                    String pref = answer.getAnswerText();
                    if (pref != null && !pref.trim().isEmpty()) {
                        return pref;
                    }
                }
            }
        }

        return "Normál menü";
    }

    private String translateMealType(MealType type) {
        if (type == null) return "étkezés";
        switch (type) {
            case BREAKFAST: return "reggeli";
            case LUNCH: return "ebéd";
            case DINNER: return "vacsora";
            default: return "étkezés";
        }
    }

    // =========================================================================
    // ÚJ: SZKENNER JOGOSULTSÁGÚ ESEMÉNYEK LEKÉRDEZÉSE (A Frontendnek)
    // =========================================================================
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getScannerEvents(String scannerEmail) {
        String originalTenant = TenantContext.getCurrentTenant();

        try {
            // A Mester DB-ben dolgozunk, hogy a szervezeteket megtaláljuk
            TenantContext.setCurrentTenant(null);

            User scanner = userRepository.findByEmail(scannerEmail).orElseThrow();
            boolean isSysAdmin = scanner.getRole() == Role.SYS_ADMIN;

            // Végigmegyünk az összes szervezeten, amihez köze van
            List<Organization> userOrgs;
            if (isSysAdmin) {
                userOrgs = organizationRepository.findAll();
            } else {
                userOrgs = scanner.getMemberships().stream()
                        .filter(m -> m.getOrganization() != null && m.getStatus() == MembershipStatus.APPROVED)
                        .map(OrganizationMember::getOrganization)
                        .collect(Collectors.toList());
            }

            java.util.List<Map<String, Object>> scannerEvents = new java.util.ArrayList<>();

            // Belenézünk minden egyes szervezetbe (Tenant)
            for (Organization org : userOrgs) {
                if (org.getTenantId() != null && !org.getTenantId().trim().isEmpty()) {
                    TenantContext.setCurrentTenant(org.getTenantId());

                    // REQUIRES_NEW-vel lekérdezzük a Tenantban levő eseményeit!
                    scannerEvents.addAll(self.fetchScannerEventsInTenant(scanner.getId(), isSysAdmin));
                }
            }

            return scannerEvents;

        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public List<Map<String, Object>> fetchScannerEventsInTenant(Long scannerId, boolean isSysAdmin) {
        // Veszünk egy "most" időpontot, amiből levonunk 1 napot, hogy a fesztivál
        // utáni nap reggelén a bontó csapatnak még lehessen reggelit szkennelni.
        LocalDateTime activeThreshold = LocalDateTime.now().minusDays(1);

        if (isSysAdmin) {
            return eventRepository.findAll().stream()
                    // --- ÚJ: Csak az aktív / jövőbeli események ---
                    .filter(e -> e.getEndTime() != null && e.getEndTime().isAfter(activeThreshold))
                    .map(e -> {
                        Map<String, Object> map = new java.util.HashMap<>();
                        map.put("id", e.getId());
                        map.put("title", e.getTitle());
                        return map;
                    }).collect(Collectors.toList());
        }

        // Önkénteseknél (Pultosoknál) is szűrjük az időpontot!
        return eventTeamMemberRepository.findByUserId(scannerId).stream()
                .filter(tm -> tm.getEvent() != null)
                // --- ÚJ: Csak az aktív / jövőbeli események ---
                .filter(tm -> tm.getEvent().getEndTime() != null && tm.getEvent().getEndTime().isAfter(activeThreshold))
                // --- Jogosultság szűrés ---
                .filter(tm -> tm.getRole() == EventRole.ORGANIZER ||
                        tm.getRole() == EventRole.COORDINATOR ||
                        tm.getRole() == EventRole.MEAL_SCANNER)
                .map(tm -> {
                    Map<String, Object> map = new java.util.HashMap<>();
                    map.put("id", tm.getEvent().getId());
                    map.put("title", tm.getEvent().getTitle());
                    return map;
                }).collect(Collectors.toList());
    }

    // =========================================================================
    // VISSZAVONÁS: Karmester metódus
    // =========================================================================
    public Map<String, Object> routeAndUndoLastScan(Long volunteerId, Long eventId, String scannerEmail, MealType mealType) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.setCurrentTenant(null);
            Event event = eventRepository.findById(eventId)
                    .orElseThrow(() -> new RuntimeException("Esemény nem található!"));

            if (event.getOrganization() != null && event.getOrganization().getTenantId() != null) {
                TenantContext.setCurrentTenant(event.getOrganization().getTenantId());
            }
            return self.undoLastScanInTenant(volunteerId, eventId, scannerEmail, mealType);
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    // =========================================================================
    // VISSZAVONÁS: Tényleges törlés a Tenantban
    // =========================================================================
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Map<String, Object> undoLastScanInTenant(Long volunteerId, Long eventId, String scannerEmail, MealType mealType) {
        // Jogosultság ellenőrzése (ugyanaz, mint a kiadásnál)
        User scanner = userRepository.findByEmail(scannerEmail).orElseThrow();
        boolean isSysAdmin = scanner.getRole() != null && scanner.getRole().name().equals("SYS_ADMIN");
        boolean hasEventPermission = eventTeamMemberRepository.findByEventId(eventId).stream()
                .anyMatch(tm -> tm.getUserId().equals(scanner.getId()) &&
                        (tm.getRole() == EventRole.ORGANIZER || tm.getRole() == EventRole.COORDINATOR || tm.getRole() == EventRole.MEAL_SCANNER));

        if (!isSysAdmin && !hasEventPermission) {
            return Map.of("success", false, "message", "Nincs jogosultságod visszavonni a beolvasást!");
        }

        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = LocalDate.now().atTime(LocalTime.MAX);

        Optional<MealConsumptionLog> lastLog = mealLogRepository.findFirstByVolunteerIdAndEventIdAndMealTypeAndConsumedAtBetweenOrderByConsumedAtDesc(
                volunteerId, eventId, mealType, startOfDay, endOfDay);

        if (lastLog.isEmpty()) {
            return Map.of("success", false, "message", "Nincs mai " + translateMealType(mealType) + " beolvasás, amit vissza lehetne vonni.");
        }

        mealLogRepository.delete(lastLog.get());
        return Map.of("success", true, "message", "Sikeresen visszavontad az utolsó " + translateMealType(mealType) + " kiadását!");
    }

    // =========================================================================
    // CATERING DASHBOARD: Napi lista lekérése (Karmester)
    // =========================================================================
    public List<CateringDTO.CateringVolunteer> routeAndGetDailyVolunteers(Long eventId, LocalDate date, String requesterEmail) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.setCurrentTenant(null);
            Event event = eventRepository.findById(eventId).orElseThrow();
            if (event.getOrganization() != null && event.getOrganization().getTenantId() != null) {
                TenantContext.setCurrentTenant(event.getOrganization().getTenantId());
            }
            return self.getDailyVolunteersInTenant(eventId, date, requesterEmail);
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public List<CateringDTO.CateringVolunteer> getDailyVolunteersInTenant(Long eventId, LocalDate date, String requesterEmail) {
        User requester = userRepository.findByEmail(requesterEmail).orElseThrow();
        EventTeamMember coordinator = eventTeamMemberRepository.findByEventId(eventId).stream()
                .filter(tm -> tm.getUserId().equals(requester.getId()))
                .findFirst().orElseThrow(() -> new RuntimeException("Nem vagy szervező!"));

        // JAVÍTÁS 1: Egyelőre kikapcsoljuk a lokális munkaterület-szűrést, amíg az EventTeamMember
        // entitásba be nem kerül a 'managedWorkAreas' mező.
        boolean isGlobal = true;

        // A te meglévő metódusod hívása:
        List<Application> apps = applicationRepository.findActiveApplicationsByEventAndStatus(eventId, ApplicationStatus.APPROVED);

        LocalDateTime startOfDay = date.atStartOfDay();
        LocalDateTime endOfDay = date.atTime(LocalTime.MAX);
        List<MealConsumptionLog> dailyLogs = mealLogRepository.findByEventIdAndConsumedAtBetween(eventId, startOfDay, endOfDay);

        List<CateringDTO.CateringVolunteer> result = new java.util.ArrayList<>();

        for (Application app : apps) {
            User volunteer = userRepository.findById(app.getUserId()).orElse(null);
            if (volunteer == null) continue;

            String diet = getDietaryPreference(volunteer, app.getEvent());

            // JAVÍTÁS 2: Használjuk a te MEGLÉVŐ repó metódusaidat a műszakok ellenőrzésére!
            int breakfasts = shiftAssignmentRepository.sumBreakfastsForUserToday(volunteer.getId(), eventId, startOfDay, endOfDay, AssignmentStatus.CONFIRMED);
            int lunches = shiftAssignmentRepository.sumLunchesForUserToday(volunteer.getId(), eventId, startOfDay, endOfDay, AssignmentStatus.CONFIRMED);
            int dinners = shiftAssignmentRepository.sumDinnersForUserToday(volunteer.getId(), eventId, startOfDay, endOfDay, AssignmentStatus.CONFIRMED);

            List<String> eligibleMeals = new java.util.ArrayList<>();
            if (breakfasts > 0) eligibleMeals.add("BREAKFAST");
            if (lunches > 0) eligibleMeals.add("LUNCH");
            if (dinners > 0) eligibleMeals.add("DINNER");

            List<CateringDTO.MealScanHistory> userScans = dailyLogs.stream()
                    .filter(log -> log.getVolunteer().getId().equals(volunteer.getId()))
                    .map(log -> new CateringDTO.MealScanHistory(
                            log.getId(),
                            log.getMealType().name(),
                            log.getConsumedAt().toString(),
                            log.getScannedBy().getName()
                    ))
                    .collect(Collectors.toList());

            result.add(new CateringDTO.CateringVolunteer(
                    volunteer.getId(),
                    volunteer.getName(),
                    app.getAssignedWorkArea() != null ? app.getAssignedWorkArea().getName() : "Nincs beosztva",
                    diet,
                    eligibleMeals,
                    userScans
            ));
        }
        return result;
    }

    // =========================================================================
    // CATERING DASHBOARD: Statisztikák lekérése (Karmester)
    // =========================================================================
    public CateringDTO.CateringSummary routeAndGetDailySummary(Long eventId, LocalDate date, String requesterEmail) {
        // A statisztika ugyanarra a Tenant-os logikára és leszűrt listára épül!
        List<CateringDTO.CateringVolunteer> volunteers = routeAndGetDailyVolunteers(eventId, date, requesterEmail);

        return new CateringDTO.CateringSummary(
                calculateStats(volunteers, "BREAKFAST"),
                calculateStats(volunteers, "LUNCH"),
                calculateStats(volunteers, "DINNER")
        );
    }

    private CateringDTO.MealStats calculateStats(List<CateringDTO.CateringVolunteer> volunteers, String mealType) {
        int normal = 0, vega = 0, vegan = 0, gluten = 0, lactose = 0;

        for (CateringDTO.CateringVolunteer v : volunteers) {
            if (v.eligibleMealsToday().contains(mealType)) {
                switch (v.dietaryPreference().toLowerCase()) {
                    case "vegetáriánus": vega++; break;
                    case "vegán": vegan++; break;
                    case "gluténmentes": gluten++; break;
                    case "laktózmentes": lactose++; break;
                    default: normal++; break;
                }
            }
        }
        return new CateringDTO.MealStats(normal, vega, vegan, gluten, lactose, normal + vega + vegan + gluten + lactose);
    }

    // =========================================================================
    // CATERING DASHBOARD: Menü (diéta) manuális átírása
    // =========================================================================
    public void routeAndUpdateDiet(Long eventId, Long userId, String newDiet, String requesterEmail) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.setCurrentTenant(null);
            Event event = eventRepository.findById(eventId).orElseThrow();
            if (event.getOrganization() != null && event.getOrganization().getTenantId() != null) {
                TenantContext.setCurrentTenant(event.getOrganization().getTenantId());
            }
            self.updateDietInTenant(eventId, userId, newDiet, requesterEmail);
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void updateDietInTenant(Long eventId, Long userId, String newDiet, String requesterEmail) {

        // Megkeressük a jelentkezést
        Application app = applicationRepository.findByUserIdAndEventId(userId, eventId)
                .stream().findFirst().orElseThrow(() -> new RuntimeException("Nincs jelentkezés!"));

        // Megkeressük a "DIETARY_PREFERENCE" típusú kérdést az eseményben
        EventQuestion dietQuestion = eventQuestionRepository.findByEventIdAndPurpose(eventId, QuestionPurpose.DIETARY_PREFERENCE)
                .orElseThrow(() -> new RuntimeException("Ebben az eseményben nincs étkezési igény kérdés beállítva!"));

        // Megkeressük a korábbi választ, vagy létrehozunk egy újat, ha eddig nem volt
        ApplicationAnswer answer = applicationAnswerRepository.findByApplicationIdAndQuestionId(app.getId(), dietQuestion.getId())
                .orElse(ApplicationAnswer.builder()
                        .application(app)
                        .question(dietQuestion)
                        .build());

        // Felülírjuk és mentjük
        answer.setAnswerText(newDiet);
        applicationAnswerRepository.save(answer);
    }
}