package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.MealConsumptionLog;
import com.example.volunteermanagement.model.MealType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface MealConsumptionLogRepository extends JpaRepository<MealConsumptionLog, Long> {

    @Query("SELECT COUNT(m) FROM MealConsumptionLog m WHERE m.volunteer.id = :volunteerId AND m.event.id = :eventId AND m.consumedAt >= :startOfDay AND m.consumedAt <= :endOfDay")
    long countMealsConsumedToday(
            @Param("volunteerId") Long volunteerId,
            @Param("eventId") Long eventId,
            @Param("startOfDay") LocalDateTime startOfDay,
            @Param("endOfDay") LocalDateTime endOfDay
    );

    @Query("SELECT COUNT(m) FROM MealConsumptionLog m WHERE m.volunteer.id = :volunteerId AND m.event.id = :eventId AND m.mealType = :mealType AND m.consumedAt >= :startOfDay AND m.consumedAt <= :endOfDay")
    long countMealsConsumedTodayByType(
            @Param("volunteerId") Long volunteerId,
            @Param("eventId") Long eventId,
            @Param("mealType") MealType mealType,
            @Param("startOfDay") LocalDateTime startOfDay,
            @Param("endOfDay") LocalDateTime endOfDay
    );

    // Megkeresi a mai nap legutóbbi fogyasztását egy adott ételtípusból
    Optional<MealConsumptionLog> findFirstByVolunteerIdAndEventIdAndMealTypeAndConsumedAtBetweenOrderByConsumedAtDesc(
            Long volunteerId, Long eventId, MealType mealType, LocalDateTime startOfDay, LocalDateTime endOfDay
    );

    // =========================================================================
    // --- ÚJ METÓDUS A CATERING DASHBOARDHOZ ---
    // =========================================================================
    // Lekéri az adott nap összes ételkiadását az eseményen (a statisztikához és a listához)
    List<MealConsumptionLog> findByEventIdAndConsumedAtBetween(Long eventId, LocalDateTime startOfDay, LocalDateTime endOfDay);
}