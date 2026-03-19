package com.example.volunteermanagement.dto;

import java.util.List;

public record MyShiftDTO(
        Long assignmentId,
        Long shiftId,
        String eventName,
        String workAreaName,
        String shiftName, // <-- ÚJ MEZŐ: Ez hiányzott!
        String startTime,
        String endTime,
        String status,
        String message,
        String type,
        String description,
        List<String> coWorkers
) {}