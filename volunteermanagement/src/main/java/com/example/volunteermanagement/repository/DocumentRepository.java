package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocumentRepository extends JpaRepository<Document, Long> {

    List<Document> findByTenantId(String tenantId);

    // Lekéri egy adott esemény összes dokumentumát (pl. a szervezőnek)
    List<Document> findByEventId(Long eventId);

    // Lekéri egy adott önkéntes feltöltéseit egy adott eseményhez
    List<Document> findByEventIdAndUserId(Long eventId, Long userId);
}