package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Event;
import com.example.volunteermanagement.model.EventRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Set;

public interface EventRepository extends JpaRepository<Event, Long> {

    // Ez a metódus most már tud lapozni (Pageable) és szűrni (OrganizationId) egyszerre!
    Page<Event> findAllByOrganizationId(Long organizationId, Pageable pageable);
    // Visszaadja azokat az eseményeket, amik a megadott szervezet ID-k valamelyikéhez tartoznak
    Page<Event> findByOrganizationIdIn(List<Long> organizationIds, Pageable pageable);

    // SYS_ADMIN-nak: Minden esemény, ami még nem járt le
    @Query("SELECT e FROM Event e WHERE e.endTime >= CURRENT_TIMESTAMP")
    List<Event> findAllActiveEvents();

    // Sima felhasználónak: Csak a saját eseményei, ahol jogosult a szkennelésre, és még nem járt le
    @Query("SELECT etm.event FROM EventTeamMember etm " +
            "WHERE etm.userId = :userId " +
            "AND etm.role IN :roles " +
            "AND etm.event.endTime >= CURRENT_TIMESTAMP " +
            "AND etm.deletedAt IS NULL") // A puha törlést (soft delete) is figyelembe vesszük!
    List<Event> findActiveEventsForScanner(@Param("userId") Long userId, @Param("roles") Set<EventRole> roles);
}