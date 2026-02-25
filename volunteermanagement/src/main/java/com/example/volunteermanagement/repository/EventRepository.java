package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Event;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EventRepository extends JpaRepository<Event, Long> {

    // Ez a metódus most már tud lapozni (Pageable) és szűrni (OrganizationId) egyszerre!
    Page<Event> findAllByOrganizationId(Long organizationId, Pageable pageable);
    // Visszaadja azokat az eseményeket, amik a megadott szervezet ID-k valamelyikéhez tartoznak
    Page<Event> findByOrganizationIdIn(List<Long> organizationIds, Pageable pageable);
}