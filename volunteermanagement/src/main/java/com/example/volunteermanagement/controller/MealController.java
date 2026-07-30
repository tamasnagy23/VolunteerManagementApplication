package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.QrScanRequest;
import com.example.volunteermanagement.service.MealService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/meals")
@RequiredArgsConstructor
public class MealController {

    private final MealService mealService;

    @PostMapping("/scan")
    public ResponseEntity<Map<String, Object>> scanMealQr(
            @Valid @RequestBody QrScanRequest request,
            Authentication authentication
    ) {
        // A Spring Security-ből kiszedjük, hogy ki olvasta be a kódot (a pultos emailje)
        String scannerEmail = authentication.getName();

        // Átadjuk a munkát a Service-nek
        Map<String, Object> result = mealService.processQrScan(
                request.volunteerId(),
                request.eventId(),
                scannerEmail
        );

        // Ha a success true, akkor 200 OK, ha false, akkor 400 Bad Request formájában küldjük vissza
        if ((Boolean) result.get("success")) {
            return ResponseEntity.ok(result);
        } else {
            return ResponseEntity.badRequest().body(result);
        }
    }
}