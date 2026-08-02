package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.EventQuestion;
import com.example.volunteermanagement.model.QuestionPurpose;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EventQuestionRepository extends JpaRepository<EventQuestion, Long> {

    // Megkeresi egy adott eseményben azt a kérdést, ami egy specifikus célt szolgál (pl. DIETARY_PREFERENCE)
    Optional<EventQuestion> findByEventIdAndPurpose(Long eventId, QuestionPurpose purpose);
}