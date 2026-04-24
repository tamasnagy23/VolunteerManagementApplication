package com.example.volunteermanagement.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record AnnouncementDTO(
        Long id,
        String title,
        String content,
        List<String> imageUrls,
        Long authorId,
        String authorName,
        String authorAvatarUrl,
        String targetDisplayName, // ÚJ: Pl. "Rendszerüzenet", "Sziget Fesztivál", "VIP Csapat"
        Long organizationId,
        Long eventId,
        Long workAreaId,
        LocalDateTime createdAt,
        List<AnnouncementCommentDTO> comments,
        Map<String, Long> reactionCounts,
        String currentUserReaction,
        String authorRole
) {}