package com.example.volunteermanagement.dto;

import jakarta.validation.constraints.NotNull;

public record QrScanRequest(
        @NotNull(message = "Az önkéntes ID-ja nem lehet üres")
        Long volunteerId,

        @NotNull(message = "Az esemény ID-ja nem lehet üres")
        Long eventId
) {}