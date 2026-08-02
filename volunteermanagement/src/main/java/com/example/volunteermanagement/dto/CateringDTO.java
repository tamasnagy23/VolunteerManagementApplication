package com.example.volunteermanagement.dto;

import java.util.List;

public class CateringDTO {

    public record CateringSummary(
            MealStats breakfast,
            MealStats lunch,
            MealStats dinner
    ) {}

    public record MealStats(
            int normal,
            int vegetarian,
            int vegan,
            int glutenFree,
            int lactoseFree,
            int total
    ) {}

    public record MealScanHistory(
            Long id,
            String mealType,
            String scannedAt,
            String scannedByUserName
    ) {}

    public record CateringVolunteer(
            Long userId,
            String name,
            String workAreaName,
            String dietaryPreference,
            List<String> eligibleMealsToday,
            List<MealScanHistory> scansToday
    ) {}
}