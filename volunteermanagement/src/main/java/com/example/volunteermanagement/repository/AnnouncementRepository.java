package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Announcement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {
    List<Announcement> findByEventIdOrderByCreatedAtDesc(Long eventId);
    List<Announcement> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    // A MÁGIKUS QUERY A DASHBOARD HÍRFOLYAMHOZ:
    // Hozza a globálisakat, VAGY aminek a szervezetében tag, VAGY aminek az eseményén tag, VAGY aminek a területén tag.
    @Query("SELECT a FROM Announcement a WHERE " +
            "(a.organizationId IS NULL AND a.eventId IS NULL AND a.workAreaId IS NULL) OR " +
            "(a.organizationId IN :orgIds AND a.eventId IS NULL AND a.workAreaId IS NULL) OR " +
            "(a.eventId IN :eventIds AND a.workAreaId IS NULL) OR " +
            "(a.workAreaId IN :areaIds) " +
            "ORDER BY a.createdAt DESC")
    List<Announcement> findPersonalizedFeed(
            @Param("orgIds") List<Long> orgIds,
            @Param("eventIds") List<Long> eventIds,
            @Param("areaIds") List<Long> areaIds
    );
}