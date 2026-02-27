package com.example.volunteermanagement.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateWorkAreaRequest(
        @NotBlank(message = "A terület neve kötelező")
        String name,

        String description,

        @NotNull(message = "A kapacitás megadása kötelező")
        @Min(value = 1, message = "Legalább 1 fő kapacitás szükséges")
        Integer capacity
) {}