package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Shift;
import com.example.volunteermanagement.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ShiftRepository extends JpaRepository<Shift, Long> {
}