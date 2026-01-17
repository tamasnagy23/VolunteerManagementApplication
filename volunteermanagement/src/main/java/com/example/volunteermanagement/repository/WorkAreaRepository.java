package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.WorkArea;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface WorkAreaRepository extends JpaRepository<WorkArea, Long> {
    List<WorkArea> findByEventId(Long eventId);
}