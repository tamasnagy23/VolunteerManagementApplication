package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    // A legújabbtól a legrégebbi felé rendezve adja vissza
    List<AuditLog> findAllByOrderByTimestampDesc();
    // A szervezőknek: Csak azokat a logokat adjuk vissza, amik az ő szervezeteikhez tartoznak
    List<AuditLog> findByOrganizationIdInOrderByTimestampDesc(List<Long> organizationIds);
}