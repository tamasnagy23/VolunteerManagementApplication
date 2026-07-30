package com.example.volunteermanagement.dto;

import java.util.List;

public record WorkAreaDTO(
        Long id,
        String name,
        String description,
        Integer capacity,
        Integer mealsPerShift,
        List<ShiftDTO> shifts
) {}