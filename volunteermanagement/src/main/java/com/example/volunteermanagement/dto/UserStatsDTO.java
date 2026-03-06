package com.example.volunteermanagement.dto;

public record UserStatsDTO(
        int totalHours,
        int completedEvents,
        int activeOrganizations
) {}