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
        List<AssignedUserDTO> assignedUsers
) {}