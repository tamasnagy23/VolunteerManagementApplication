package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.ApplicationAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ApplicationAnswerRepository extends JpaRepository<ApplicationAnswer, Long> {

    // Megkeresi egy adott jelentkezéshez tartozó adott kérdésre adott választ
    Optional<ApplicationAnswer> findByApplicationIdAndQuestionId(Long applicationId, Long questionId);
}