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

        // --- ÚJ: Ezt is kiküldjük és fogadjuk a Reactből ---
        int maxBackupVolunteers,

        String type,
        String description,

        List<AssignedUserDTO> assignedUsers
) {}