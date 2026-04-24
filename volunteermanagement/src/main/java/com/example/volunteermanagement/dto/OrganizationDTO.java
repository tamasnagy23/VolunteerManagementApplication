package com.example.volunteermanagement.dto;

public record OrganizationDTO(
        Long id,
        String name,
        String tenantId,
        String address,
        String description,
        String email,
        String phone,
        String logoUrl,
        String bannerUrl // <--- JAVÍTÁS: Borítókép mező hozzáadva
) {}