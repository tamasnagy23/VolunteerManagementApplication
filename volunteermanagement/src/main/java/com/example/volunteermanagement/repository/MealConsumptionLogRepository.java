package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.MealConsumptionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface MealConsumptionLogRepository extends JpaRepository<MealConsumptionLog, Long> {

    // Ezzel számoljuk ki, hányszor evett ma az illető az adott eseményen
    @Query("SELECT COUNT(m) FROM MealConsumptionLog m WHERE m.volunteer.id = :volunteerId AND m.event.id = :eventId AND m.consumedAt >= :startOfDay AND m.consumedAt <= :endOfDay")
    long countMealsConsumedToday(
            @Param("volunteerId") Long volunteerId,
            @Param("eventId") Long eventId,
            @Param("startOfDay") LocalDateTime startOfDay,
            @Param("endOfDay") LocalDateTime endOfDay
    );
}