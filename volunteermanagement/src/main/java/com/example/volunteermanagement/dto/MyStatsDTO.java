package com.example.volunteermanagement.dto;

public record MyStatsDTO(
        long completedShifts,
        double totalHoursWorked,
        long upcomingShifts
) {}