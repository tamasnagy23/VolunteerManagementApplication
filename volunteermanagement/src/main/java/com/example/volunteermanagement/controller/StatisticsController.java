package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.EventStatsDTO;
import com.example.volunteermanagement.dto.MyStatsDTO;
import com.example.volunteermanagement.service.StatisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/api/statistics")
@RequiredArgsConstructor
public class StatisticsController {

    private final StatisticsService statisticsService;

    // Önkéntes saját statisztikája
    @GetMapping("/me")
    public ResponseEntity<MyStatsDTO> getMyStats(Principal principal) {
        String email = principal.getName();
        return ResponseEntity.ok(statisticsService.getMyStatistics(email));
    }

    // Szervezői statisztika egy adott eseményről (Portással védve)
    @GetMapping("/event/{eventId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<EventStatsDTO> getEventStats(@PathVariable Long eventId, Principal principal) {
        // Átadjuk az email címet is a jogosultság ellenőrzéshez
        return ResponseEntity.ok(statisticsService.getEventStatistics(eventId, principal.getName()));
    }

    // =========================================================================
    // ÚJ: Csak a felhasználó által menedzselt események listája a legördülőhöz
    // =========================================================================
    @GetMapping("/managed-events")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getManagedEvents(Principal principal) {
        return ResponseEntity.ok(statisticsService.getManagedEvents(principal.getName()));
    }
}