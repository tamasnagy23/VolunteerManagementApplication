package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.AssignmentStatus;
import com.example.volunteermanagement.model.MealType;
import com.example.volunteermanagement.model.ShiftAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ShiftAssignmentRepository extends JpaRepository<ShiftAssignment, Long> {

    List<ShiftAssignment> findByUserId(Long userId);
    Optional<ShiftAssignment> findByShiftIdAndUserId(Long shiftId, Long userId);

    @Query("SELECT COALESCE(SUM(sa.shift.providedBreakfasts), 0) FROM ShiftAssignment sa WHERE sa.userId = :userId AND sa.shift.event.id = :eventId AND sa.status = :status AND sa.shift.startTime >= :startOfDay AND sa.shift.startTime <= :endOfDay")
    int sumBreakfastsForUserToday(@Param("userId") Long userId, @Param("eventId") Long eventId, @Param("startOfDay") LocalDateTime startOfDay, @Param("endOfDay") LocalDateTime endOfDay, @Param("status") AssignmentStatus status);

    @Query("SELECT COALESCE(SUM(sa.shift.providedLunches), 0) FROM ShiftAssignment sa WHERE sa.userId = :userId AND sa.shift.event.id = :eventId AND sa.status = :status AND sa.shift.startTime >= :startOfDay AND sa.shift.startTime <= :endOfDay")
    int sumLunchesForUserToday(@Param("userId") Long userId, @Param("eventId") Long eventId, @Param("startOfDay") LocalDateTime startOfDay, @Param("endOfDay") LocalDateTime endOfDay, @Param("status") AssignmentStatus status);

    @Query("SELECT COALESCE(SUM(sa.shift.providedDinners), 0) FROM ShiftAssignment sa WHERE sa.userId = :userId AND sa.shift.event.id = :eventId AND sa.status = :status AND sa.shift.startTime >= :startOfDay AND sa.shift.startTime <= :endOfDay")
    int sumDinnersForUserToday(@Param("userId") Long userId, @Param("eventId") Long eventId, @Param("startOfDay") LocalDateTime startOfDay, @Param("endOfDay") LocalDateTime endOfDay, @Param("status") AssignmentStatus status);
}