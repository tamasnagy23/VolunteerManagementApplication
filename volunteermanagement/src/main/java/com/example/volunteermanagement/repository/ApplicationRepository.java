package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Application;
import com.example.volunteermanagement.model.ApplicationStatus;
import com.example.volunteermanagement.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ApplicationRepository extends JpaRepository<Application, Long> {

    List<Application> findByUserAndEventId(User user, Long eventId);
    List<Application> findByUser(User user);
    List<Application> findByEventId(Long eventId);
    List<Application> findByStatus(ApplicationStatus status);

    // Ezt az egyet add hozzá a statisztikákhoz:
    @Query("SELECT a FROM Application a " +
            "WHERE a.user.id = :userId " +
            "AND a.status = 'APPROVED' " +
            "AND a.event.endTime < CURRENT_TIMESTAMP")
    List<Application> findCompletedApplicationsByUser(@Param("userId") Long userId);

    @Query("SELECT a FROM Application a " +
            "WHERE a.event.id = :eventId " +
            "AND a.status = :status " +
            "AND a.user.name <> 'Törölt Felhasználó'")
    List<Application> findActiveApplicationsByEventAndStatus(
            @Param("eventId") Long eventId,
            @Param("status") ApplicationStatus status
    );
}