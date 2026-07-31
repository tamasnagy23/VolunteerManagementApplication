package com.example.volunteermanagement.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ShiftDTO(
        Long id,
        Long workAreaId,
        String workAreaName,
        String name,
        LocalDateTime startTime,
        LocalDateTime endTime,
        int maxVolunteers,
        int maxBackupVolunteers,

        // --- ÚJ: Étel számlálók a frontend felé/felől ---
        int providedBreakfasts,
        int providedLunches,
        int providedDinners,

        String type,
        String description,

        List<AssignedUserDTO> assignedUsers
) {}