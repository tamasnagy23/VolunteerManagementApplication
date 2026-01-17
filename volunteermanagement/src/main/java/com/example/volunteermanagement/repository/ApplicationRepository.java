package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Application;
import com.example.volunteermanagement.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ApplicationRepository extends JpaRepository<Application, Long> {
    // Megnézzük, jelentkezett-e már a user erre az eseményre (ne jelentkezhessen kétszer)
    Optional<Application> findByUserAndEventId(User user, Long eventId);

    // A User saját jelentkezései
    List<Application> findByUser(User user);

    // A Koordinátornak: egy esemény összes jelentkezése
    List<Application> findByEventId(Long eventId);
}