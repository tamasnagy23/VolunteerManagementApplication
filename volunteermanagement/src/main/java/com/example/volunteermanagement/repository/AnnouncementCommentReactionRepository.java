package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.AnnouncementCommentReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface AnnouncementCommentReactionRepository extends JpaRepository<AnnouncementCommentReaction, Long> {
    Optional<AnnouncementCommentReaction> findByCommentIdAndUserId(Long commentId, Long userId);
}