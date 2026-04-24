package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Application;
import com.example.volunteermanagement.model.ApplicationStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ApplicationRepository extends JpaRepository<Application, Long> {

    List<Application> findByUserIdAndEventId(Long userId, Long eventId);
    @EntityGraph(attributePaths = {"event"})
    List<Application> findByUserId(Long userId);
    List<Application> findByEventId(Long eventId);
    List<Application> findByStatus(ApplicationStatus status);

    // JAVÍTVA: a.user.id helyett a.userId
    @Query("SELECT a FROM Application a " +
            "WHERE a.userId = :userId " +
            "AND a.status = 'APPROVED' " +
            "AND a.event.endTime < CURRENT_TIMESTAMP")
    List<Application> findCompletedApplicationsByUser(@Param("userId") Long userId);

    // JAVÍTVA: Kivettük a.user.name ellenőrzést, mert a név a Master DB-ben van!
    @Query("SELECT a FROM Application a " +
            "WHERE a.event.id = :eventId " +
            "AND a.status = :status")
    List<Application> findActiveApplicationsByEventAndStatus(
            @Param("eventId") Long eventId,
            @Param("status") ApplicationStatus status
    );
}