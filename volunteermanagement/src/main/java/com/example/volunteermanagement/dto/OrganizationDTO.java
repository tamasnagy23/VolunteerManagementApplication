package com.example.volunteermanagement.dto;

public record OrganizationDTO(
        Long id,
        String name,
        String address,
        String description,
        String email,
        String phone
) {}