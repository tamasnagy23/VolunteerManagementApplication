package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.QrScanRequest;
import com.example.volunteermanagement.service.MealService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
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
        String scannerEmail = authentication.getName();

        // --- ÚJ: A 'routeAndProcessQrScan' metódust hívjuk, ami megkeresi a helyes DB-t ---
        Map<String, Object> result = mealService.routeAndProcessQrScan(
                request.volunteerId(),
                request.eventId(),
                scannerEmail,
                request.mealType()
        );

        if ((Boolean) result.get("success")) {
            return ResponseEntity.ok(result);
        } else {
            return ResponseEntity.badRequest().body(result);
        }
    }

    @GetMapping("/scanner-events")
    public ResponseEntity<List<Map<String, Object>>> getScannerAllowedEvents(Authentication authentication) {
        String scannerEmail = authentication.getName();
        return ResponseEntity.ok(mealService.getScannerEvents(scannerEmail));
    }

    @PostMapping("/undo")
    public ResponseEntity<Map<String, Object>> undoMealScan(
            @Valid @RequestBody QrScanRequest request,
            Authentication authentication
    ) {
        String scannerEmail = authentication.getName();
        Map<String, Object> result = mealService.routeAndUndoLastScan(
                request.volunteerId(),
                request.eventId(),
                scannerEmail,
                request.mealType()
        );

        if ((Boolean) result.get("success")) {
            return ResponseEntity.ok(result);
        } else {
            return ResponseEntity.badRequest().body(result);
        }
    }
}