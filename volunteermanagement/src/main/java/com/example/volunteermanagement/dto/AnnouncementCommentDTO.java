package com.example.volunteermanagement.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record AnnouncementCommentDTO(
        Long id,
        Long userId,
        String userName,
        String userAvatarUrl,
        String content,
        LocalDateTime createdAt,
        Long parentId, // Kinek a gyereke?
        List<AnnouncementCommentDTO> replies, // Válaszok listája (fába rendezve)
        Map<String, Long> reactionCounts,
        String currentUserReaction
) {}