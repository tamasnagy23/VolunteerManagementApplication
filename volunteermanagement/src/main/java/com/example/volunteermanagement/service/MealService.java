package com.example.volunteermanagement.service;

import com.example.volunteermanagement.model.AssignmentStatus;
import com.example.volunteermanagement.model.Event;
import com.example.volunteermanagement.model.MealConsumptionLog;
import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.repository.EventRepository;
import com.example.volunteermanagement.repository.MealConsumptionLogRepository;
import com.example.volunteermanagement.repository.ShiftAssignmentRepository;
import com.example.volunteermanagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class MealService {

    private final MealConsumptionLogRepository mealLogRepository;
    private final ShiftAssignmentRepository shiftAssignmentRepository;
    private final UserRepository userRepository;
    private final EventRepository eventRepository;

    @Transactional
    public Map<String, Object> processQrScan(Long volunteerId, Long eventId, String scannerEmail) {
        // 1. Szereplők betöltése
        User volunteer = userRepository.findById(volunteerId)
                .orElseThrow(() -> new RuntimeException("Önkéntes nem található!"));
        User scanner = userRepository.findByEmail(scannerEmail)
                .orElseThrow(() -> new RuntimeException("Szkenner felhasználó nem található!"));
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Esemény nem található!"));

        // 2. Mai időablak (00:00 - 23:59)
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = LocalDate.now().atTime(LocalTime.MAX);

        // 3. Mai jogosultság lekérése a jóváhagyott műszakok alapján
        // Feltételezem, hogy az AssignmentStatus.APPROVED jelöli a fixált műszakot
        int dailyAllowance = shiftAssignmentRepository.sumMealsForUserToday(
                volunteerId,
                eventId,
                startOfDay,
                endOfDay,
                AssignmentStatus.CONFIRMED
        );

        if (dailyAllowance == 0) {
            return Map.of(
                    "success", false,
                    "message", "Ma nem dolgozol, vagy a mai beosztásaidhoz nem jár étkezés."
            );
        }

        // 4. Mai eddigi fogyasztások ellenőrzése
        long consumedToday = mealLogRepository.countMealsConsumedToday(volunteerId, eventId, startOfDay, endOfDay);

        if (consumedToday >= dailyAllowance) {
            return Map.of(
                    "success", false,
                    "message", "A mai étkezési keretedet (" + dailyAllowance + "/" + dailyAllowance + ") már teljesen felhasználtad!"
            );
        }

        // 5. Kiadjuk az ételt! Naplózás
        // Később ide behúzhatjuk a kérdőívből az étkezési igényt
        String dietaryPref = getDietaryPreference(volunteer, event);

        MealConsumptionLog log = MealConsumptionLog.builder()
                .volunteer(volunteer)
                .event(event)
                .scannedBy(scanner)
                .consumedAt(LocalDateTime.now())
                .dietaryPreference(dietaryPref)
                .build();

        mealLogRepository.save(log);

        return Map.of(
                "success", true,
                "message", "Sikeres csekkolás! Jó étvágyat! (" + (consumedToday + 1) + "/" + dailyAllowance + ")",
                "dietaryPreference", dietaryPref != null ? dietaryPref : "Normál menü"
        );
    }

    private String getDietaryPreference(User volunteer, Event event) {
        // Amíg nincs kész a kérdőíves válaszok beolvasása, adunk egy alapértéket.
        return "Normál";
    }
}