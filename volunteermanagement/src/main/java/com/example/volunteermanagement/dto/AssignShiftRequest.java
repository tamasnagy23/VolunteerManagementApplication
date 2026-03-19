package com.example.volunteermanagement.dto;

import java.util.List;

public record AssignShiftRequest(
        List<Long> applicationIds,
        List<Long> backupApplicationIds // ÚJ: Ezek az emberek csak beugrók!
) {
    // Ha a React régi kódot küld, ahol nincs backupApplicationIds, akkor ne dobjon hibát:
    public AssignShiftRequest {
        if (backupApplicationIds == null) {
            backupApplicationIds = List.of();
        }
        if (applicationIds == null) {
            applicationIds = List.of();
        }
    }
}