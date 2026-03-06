package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Shift;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ShiftRepository extends JpaRepository<Shift, Long> {

    // Lekéri az egy eseményhez tartozó összes műszakot (a workArea-n keresztül)
    @Query("SELECT s FROM Shift s WHERE s.workArea.event.id = :eventId ORDER BY s.startTime ASC")
    List<Shift> findByEventId(@Param("eventId") Long eventId);
}