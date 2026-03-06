package com.example.volunteermanagement.dto;

import java.util.List;

public record AssignShiftRequest(
        List<Long> applicationIds
) {}