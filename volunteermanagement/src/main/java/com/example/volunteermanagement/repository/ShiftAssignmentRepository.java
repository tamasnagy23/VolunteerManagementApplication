package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.ShiftAssignment;
import com.example.volunteermanagement.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShiftAssignmentRepository extends JpaRepository<ShiftAssignment, Long> {
    List<ShiftAssignment> findByUserId(Long userId);
    Optional<ShiftAssignment> findByShiftIdAndUserId(Long shiftId, Long userId);
}