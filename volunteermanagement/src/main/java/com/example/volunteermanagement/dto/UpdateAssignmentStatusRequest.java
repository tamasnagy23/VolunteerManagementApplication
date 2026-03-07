package com.example.volunteermanagement.dto;

public record UpdateAssignmentStatusRequest(
        String status,
        String message
) {}