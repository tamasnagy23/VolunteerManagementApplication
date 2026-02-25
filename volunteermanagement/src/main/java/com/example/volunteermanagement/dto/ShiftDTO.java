package com.example.volunteermanagement.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public record ShiftDTO(
        Long id,

        @NotBlank(message = "A műszak megnevezése/területe kötelező")
        String area, // Ez lesz a Shift.name az adatbázisban

        @NotNull(message = "A kezdés ideje kötelező")
        // @Future - Ezt vedd ki, hogy szerkeszthető maradjon a múltbeli esemény is!
        LocalDateTime startTime,

        @NotNull(message = "A befejezés ideje kötelező")
        LocalDateTime endTime,

        @NotNull(message = "A maximális létszám megadása kötelező")
        @Min(value = 1, message = "Legalább 1 önkéntes szükséges")
        Integer maxVolunteers
) {}