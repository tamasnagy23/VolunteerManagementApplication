package com.example.volunteermanagement.exception;

import java.time.LocalDateTime;
import java.util.Map;

public record ErrorResponse(
        LocalDateTime timestamp,
        int status,
        String error,
        String message,
        Map<String, String> validationErrors // Ha pl. üres a név, itt írjuk ki, melyik mezővel van baj
) {}