package com.example.volunteermanagement.dto;

public record WorkAreaDTO(
        Long id,
        String name,
        String description,
        Integer capacity
) {}