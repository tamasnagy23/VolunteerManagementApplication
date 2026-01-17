package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Shift;
import com.example.volunteermanagement.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ShiftRepository extends JpaRepository<Shift, Long> {

    List<Shift> findByEventId(Long eventId);

    // RÉGI (Töröld): List<Shift> findByAssignedUser(User user);

    // ÚJ: Mivel a mező neve 'volunteers' (ami egy lista), így kell keresni benne:
    List<Shift> findByVolunteersContaining(User user);
}