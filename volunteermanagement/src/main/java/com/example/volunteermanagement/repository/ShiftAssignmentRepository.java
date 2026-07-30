package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.AssignmentStatus;
import com.example.volunteermanagement.model.ShiftAssignment;
import com.example.volunteermanagement.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ShiftAssignmentRepository extends JpaRepository<ShiftAssignment, Long> {

    // Eredeti metódusok
    List<ShiftAssignment> findByUserId(Long userId);
    Optional<ShiftAssignment> findByShiftIdAndUserId(Long shiftId, Long userId);

    // --- ÚJ METÓDUS: Étkezési keret kiszámítása ---
    @Query("SELECT COALESCE(SUM(sa.shift.workArea.mealsPerShift), 0) " +
            "FROM ShiftAssignment sa " +
            "WHERE sa.userId = :userId " +
            "AND sa.shift.event.id = :eventId " +
            "AND sa.status = :status " +
            "AND sa.shift.startTime >= :startOfDay " +
            "AND sa.shift.startTime <= :endOfDay")
    int sumMealsForUserToday(
            @Param("userId") Long userId,
            @Param("eventId") Long eventId,
            @Param("startOfDay") LocalDateTime startOfDay,
            @Param("endOfDay") LocalDateTime endOfDay,
            @Param("status") AssignmentStatus status
    );
}