package com.example.volunteermanagement.dto;

import java.util.Map;

public class StatisticsDTO {

    // Az Önkéntes saját statisztikája
    public record MyStatsDTO(
            long completedShifts,
            double totalHoursWorked,
            long upcomingShifts
    ) {}

    // A Szervező esemény-szintű statisztikája
    public record EventStatsDTO(
            long totalApprovedVolunteers,
            long totalShifts,
            long fullShifts,
            Map<String, Long> volunteersPerWorkArea
    ) {}
}