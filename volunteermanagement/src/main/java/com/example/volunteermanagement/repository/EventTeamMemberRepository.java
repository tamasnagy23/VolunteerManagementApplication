package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.EventTeamMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EventTeamMemberRepository extends JpaRepository<EventTeamMember, Long> {
    Optional<EventTeamMember> findByUserIdAndEventId(Long userId, Long eventId);
    List<EventTeamMember> findByEventId(Long eventId);

    // JAVÍTVA: findByUser helyett findByUserId, és Long paraméter!
    List<EventTeamMember> findByUserId(Long userId);
}