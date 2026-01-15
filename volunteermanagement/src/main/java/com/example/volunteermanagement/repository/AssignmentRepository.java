package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Assignment;
import com.example.volunteermanagement.model.AssignmentStatus;
import com.example.volunteermanagement.model.Shift;
import com.example.volunteermanagement.model.VolunteerProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AssignmentRepository extends JpaRepository<Assignment, Long> {

    // Adott műszak összes jelentkezése
    List<Assignment> findByShift(Shift shift);

    // Hányan vannak elfogadva az adott műszakon? (Létszámkorláthoz)
    long countByShiftAndStatus(Shift shift, AssignmentStatus status);

    // Jelentkezett-e már ez az ember erre a műszakra? (Duplikáció szűrés)
    boolean existsByVolunteerAndShift(VolunteerProfile volunteer, Shift shift);

    // Egy önkéntes összes jelentkezése (pl. "Saját műszakjaim" menüpont)
    List<Assignment> findByVolunteer(VolunteerProfile volunteer);
}