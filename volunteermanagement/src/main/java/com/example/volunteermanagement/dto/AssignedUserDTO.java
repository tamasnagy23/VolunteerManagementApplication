package com.example.volunteermanagement.dto;

public record AssignedUserDTO(
        Long applicationId,
        Long userId,
        String name,
        String email
) {}