package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.AnnouncementComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AnnouncementCommentRepository extends JpaRepository<AnnouncementComment, Long> {
}