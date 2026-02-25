package com.example.volunteermanagement.dto;

public record PendingApplicationDTO(
        Long id,
        String userName,
        String userEmail,
        String userPhone,
        String orgName,
        Long orgId
) {}