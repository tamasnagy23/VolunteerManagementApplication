package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Shift;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShiftRepository extends JpaRepository<Shift, Long> {
}