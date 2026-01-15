package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Event;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventRepository extends JpaRepository<Event, Long> {
    // Ide nem kell extra metódus egyelőre, az alap CRUD elég
}