package com.example.volunteermanagement.dto;

import java.util.Set;

public record VolunteerProfileDTO(
        String fullName,
        String phoneNumber,
        String bio,
        Set<String> skills
) {}