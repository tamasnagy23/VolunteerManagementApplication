package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.model.VolunteerProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface VolunteerProfileRepository extends JpaRepository<VolunteerProfile, Long> {
    Optional<VolunteerProfile> findByUser(User user);
}