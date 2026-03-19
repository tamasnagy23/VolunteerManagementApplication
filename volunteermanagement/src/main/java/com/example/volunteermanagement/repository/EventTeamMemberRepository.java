package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.EventTeamMember;
import com.example.volunteermanagement.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EventTeamMemberRepository extends JpaRepository<EventTeamMember, Long> {
    Optional<EventTeamMember> findByUserAndEventId(User user, Long eventId);
    List<EventTeamMember> findByEventId(Long eventId);
    List<EventTeamMember> findByUser(User user);
}