package com.example.volunteermanagement.dto;

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
        String status,
        Long eventId,
        String eventTitle,
        Map<String, String> answers,
        String userAvatar,
        String userJoinDate,
        String userOrgRole,
        String adminNote,
        String rejectionMessage,

        // --- ÚJ MEZŐ: A visszavonás indoka ---
        String withdrawalReason
) {}