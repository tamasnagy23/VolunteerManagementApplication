package com.example.volunteermanagement.dto;

import java.util.List;
import java.util.Map;

public record ApplicationSubmitDTO(
        Long eventId,
        List<Long> preferredWorkAreaIds, // Miket pipált be a területek közül
        Map<Long, String> answers        // Kérdés ID -> Önkéntes válasza szövegesen
) {}