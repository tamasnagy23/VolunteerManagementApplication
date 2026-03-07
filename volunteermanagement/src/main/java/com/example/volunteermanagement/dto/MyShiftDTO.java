package com.example.volunteermanagement.dto;

import java.util.List;

public record MyShiftDTO(
        Long assignmentId,
        Long shiftId,
        String eventName,
        String workAreaName,
        String startTime,
        String endTime,
        String status,
        String message,
        List<String> coWorkers
) {}