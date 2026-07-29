package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocumentRepository extends JpaRepository<Document, Long> {

    // Eseményhez tartozó összes dokumentum lekérése
    List<Document> findByEventId(Long eventId);

    // Egy adott felhasználó dokumentumai (pl. a saját aláírt szerződése)
    List<Document> findByUserIdAndDocumentType(Long userId, String documentType);
}