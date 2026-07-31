package com.example.volunteermanagement.service;

import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class MealService {

    private final MealConsumptionLogRepository mealLogRepository;
    private final ShiftAssignmentRepository shiftAssignmentRepository;
    private final UserRepository userRepository;
    private final EventRepository eventRepository;
    private final EventTeamMemberRepository eventTeamMemberRepository;

    @Transactional
    public Map<String, Object> processQrScan(Long volunteerId, Long eventId, String scannerEmail, MealType mealType) {
        // 1. Szereplők betöltése
        User volunteer = userRepository.findById(volunteerId)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található!"));
        User scanner = userRepository.findByEmail(scannerEmail)
                .orElseThrow(() -> new RuntimeException("Szkenner felhasználó nem található!"));
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Esemény nem található!"));

        // 2. A SZKENNER JOGOSULTSÁGÁNAK ELLENŐRZÉSE
        boolean isSysAdmin = scanner.getRole() != null && scanner.getRole().name().equals("SYS_ADMIN");
        Optional<EventTeamMember> scannerMembership = eventTeamMemberRepository.findByEventId(eventId).stream()
                .filter(tm -> tm.getUserId().equals(scanner.getId()))
                .findFirst();

        boolean hasEventPermission = scannerMembership.isPresent() &&
                (scannerMembership.get().getRole() == EventRole.ORGANIZER ||
                        scannerMembership.get().getRole() == EventRole.COORDINATOR ||
                        scannerMembership.get().getRole() == EventRole.MEAL_SCANNER);

        if (!isSysAdmin && !hasEventPermission) {
            return Map.of(
                    "success", false,
                    "message", "Nincs jogosultságod ételt osztani ezen az eseményen!"
            );
        }

        // 3. Mai időablak (00:00 - 23:59)
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = LocalDate.now().atTime(LocalTime.MAX);

        // 4. JOGOSULTSÁG KISZÁMÍTÁSA A KÉRT ÉTKEZÉS TÍPUSA ALAPJÁN
        int dailyAllowance = 0;

        Optional<EventTeamMember> teamMembership = eventTeamMemberRepository.findByEventId(eventId).stream()
                .filter(tm -> tm.getUserId().equals(volunteerId))
                .findFirst();

        if (teamMembership.isPresent() &&
                (teamMembership.get().getRole() == EventRole.ORGANIZER || teamMembership.get().getRole() == EventRole.COORDINATOR)) {
            // A szervezőknek mindenből jár napi 3 (VIP)
            dailyAllowance = 3;
        } else {
            // Önkéntes műszakjainak összegzése a specifikus ételtípus alapján
            if (mealType == MealType.BREAKFAST) {
                dailyAllowance = shiftAssignmentRepository.sumBreakfastsForUserToday(volunteerId, eventId, startOfDay, endOfDay, AssignmentStatus.CONFIRMED);
            } else if (mealType == MealType.LUNCH) {
                dailyAllowance = shiftAssignmentRepository.sumLunchesForUserToday(volunteerId, eventId, startOfDay, endOfDay, AssignmentStatus.CONFIRMED);
            } else if (mealType == MealType.DINNER) {
                dailyAllowance = shiftAssignmentRepository.sumDinnersForUserToday(volunteerId, eventId, startOfDay, endOfDay, AssignmentStatus.CONFIRMED);
            }
        }

        String translatedMeal = mealType == MealType.BREAKFAST ? "reggeli" : (mealType == MealType.LUNCH ? "ebéd" : "vacsora");

        if (dailyAllowance == 0) {
            return Map.of(
                    "success", false,
                    "message", "Ma nincs olyan beosztásod (vagy jogosultságod), amihez " + translatedMeal + " járna."
            );
        }

        // 5. Mai eddigi fogyasztások ellenőrzése az adott TÍPUSBÓL!
        long consumedToday = mealLogRepository.countMealsConsumedTodayByType(volunteerId, eventId, mealType, startOfDay, endOfDay);

        if (consumedToday >= dailyAllowance) {
            return Map.of(
                    "success", false,
                    "message", "Ebből az étkezésből (" + translatedMeal + ") a mai keretedet (" + dailyAllowance + "/" + dailyAllowance + ") már teljesen felhasználtad!"
            );
        }

        // 6. Kiadjuk az ételt! Naplózás
        String dietaryPref = getDietaryPreference(volunteer, event);

        MealConsumptionLog log = MealConsumptionLog.builder()
                .volunteer(volunteer)
                .event(event)
                .scannedBy(scanner)
                .consumedAt(LocalDateTime.now())
                .dietaryPreference(dietaryPref)
                .mealType(mealType)
                .build();

        mealLogRepository.save(log);

        return Map.of(
                "success", true,
                "message", "Sikeres csekkolás! Jó étvágyat! (" + (consumedToday + 1) + "/" + dailyAllowance + ")",
                "dietaryPreference", dietaryPref != null ? dietaryPref : "Normál menü"
        );
    }

    private String getDietaryPreference(User volunteer, Event event) {
        return "Normál"; // Később bővíthető
    }
}