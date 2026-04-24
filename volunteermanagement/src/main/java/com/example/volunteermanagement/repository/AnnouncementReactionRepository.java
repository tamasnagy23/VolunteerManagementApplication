package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.AnnouncementReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface AnnouncementReactionRepository extends JpaRepository<AnnouncementReaction, Long> {
    // Megkeresi, hogy az adott felhasználó reagált-e már erre a posztra
    Optional<AnnouncementReaction> findByAnnouncementIdAndUserId(Long announcementId, Long userId);
}