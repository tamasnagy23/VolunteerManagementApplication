package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.StatisticsDTO.EventStatsDTO;
import com.example.volunteermanagement.dto.StatisticsDTO.MyStatsDTO;
import com.example.volunteermanagement.service.StatisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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
        // A Principal a Java beépített biztonsági interfésze.
        // A .getName() a te esetedben a bejelentkezett felhasználó email címét fogja visszaadni!
        String email = principal.getName();
        return ResponseEntity.ok(statisticsService.getMyStatistics(email));
    }

    // Szervezői statisztika egy adott eseményről
    @GetMapping("/event/{eventId}")
    public ResponseEntity<EventStatsDTO> getEventStats(@PathVariable Long eventId) {
        return ResponseEntity.ok(statisticsService.getEventStatistics(eventId));
    }
}