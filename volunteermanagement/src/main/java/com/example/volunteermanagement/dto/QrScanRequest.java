package com.example.volunteermanagement.dto;

import com.example.volunteermanagement.model.MealType;
import jakarta.validation.constraints.NotNull;

public record QrScanRequest(
        @NotNull(message = "Az önkéntes ID-ja nem lehet üres")
        Long volunteerId,

        @NotNull(message = "Az esemény ID-ja nem lehet üres")
        Long eventId,

        // --- ÚJ MEZŐ: Milyen étkezést adunk épp ki? ---
        @NotNull(message = "Az étkezés típusa kötelező (BREAKFAST, LUNCH, DINNER)")
        MealType mealType
) {}