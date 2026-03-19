package com.example.volunteermanagement.dto;

import java.util.List;

public record EventTeamMemberDTO(
        Long userId,
        String userName,
        String userEmail,
        String eventRole, // ORGANIZER, COORDINATOR, vagy null (ha sima önkéntes)
        List<String> permissions, // A plecsnik
        List<Long> coordinatedWorkAreaIds // Mely területeknek a vezetője
) {}