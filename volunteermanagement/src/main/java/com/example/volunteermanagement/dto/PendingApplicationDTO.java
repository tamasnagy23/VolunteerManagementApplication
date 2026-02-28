package com.example.volunteermanagement.dto;

import com.example.volunteermanagement.model.ApplicationStatus;
import java.util.Map;

public record PendingApplicationDTO(
        Long id,
        String userName,
        String userEmail,
        String userPhone,
        String orgName,
        Long orgId,
        Long workAreaId,
        String workAreaName,
        ApplicationStatus status,
        Long eventId,
        String eventTitle,
        Map<String, String> answers,
        String userAvatar,
        String userJoinDate,
        String userOrgRole,

        // --- ÚJ MEZŐ ---
        String adminNote
) {}