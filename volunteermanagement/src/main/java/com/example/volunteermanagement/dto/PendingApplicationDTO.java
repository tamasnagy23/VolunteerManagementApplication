package com.example.volunteermanagement.dto;

import com.example.volunteermanagement.model.ApplicationStatus;

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
        // ÚJ MEZŐ: Kérdés szövege -> Válasz szövege
        java.util.Map<String, String> answers
) {}