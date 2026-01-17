package com.example.volunteermanagement.dto;

import java.time.LocalDateTime;

public record CreateShiftRequest(
        Long eventId,
        String name, // <--- EZT ADD HOZZÁ
        Long userId, // Ez opcionális marad, ha csak üreset hozunk létre
        LocalDateTime startTime,
        LocalDateTime endTime
) {}