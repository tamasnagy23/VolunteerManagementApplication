package com.example.volunteermanagement.dto;

import java.util.Map;

public record EventStatsDTO(
        long totalApprovedVolunteers,
        long totalShifts,
        long fullShifts,
        Map<String, Long> volunteersPerWorkArea
) {}