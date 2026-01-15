package com.example.volunteermanagement.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public record ShiftDTO(
        @NotNull(message = "A kezdés ideje kötelező")
        @Future(message = "A kezdésnek a jövőben kell lennie")
        LocalDateTime startTime,

        @NotNull(message = "A befejezés ideje kötelező")
        @Future(message = "A befejezésnek a jövőben kell lennie")
        LocalDateTime endTime,

        @Min(value = 1, message = "Legalább 1 önkéntesre szükség van")
        int maxVolunteers
) {}