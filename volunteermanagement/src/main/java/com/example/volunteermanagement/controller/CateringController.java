package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.CateringDTO.*;
import com.example.volunteermanagement.service.MealService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/catering")
@RequiredArgsConstructor
public class CateringController {

    private final MealService mealService;

    @GetMapping("/events/{eventId}/summary")
    public ResponseEntity<CateringSummary> getDailySummary(
            @PathVariable Long eventId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            Authentication auth) {
        return ResponseEntity.ok(mealService.routeAndGetDailySummary(eventId, date, auth.getName()));
    }

    @GetMapping("/events/{eventId}/volunteers")
    public ResponseEntity<List<CateringVolunteer>> getDailyVolunteers(
            @PathVariable Long eventId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            Authentication auth) {
        return ResponseEntity.ok(mealService.routeAndGetDailyVolunteers(eventId, date, auth.getName()));
    }

    @PutMapping("/events/{eventId}/volunteers/{userId}/diet")
    public ResponseEntity<Void> updateDietaryPreference(
            @PathVariable Long eventId,
            @PathVariable Long userId,
            @RequestBody Map<String, String> request,
            Authentication auth) {
        mealService.routeAndUpdateDiet(eventId, userId, request.get("dietaryPreference"), auth.getName());
        return ResponseEntity.ok().build();
    }
}