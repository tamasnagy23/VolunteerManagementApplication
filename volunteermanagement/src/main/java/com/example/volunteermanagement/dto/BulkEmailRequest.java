package com.example.volunteermanagement.dto;

import java.util.List;

public record BulkEmailRequest(
        List<Long> applicationIds,
        String subject,
        String message
) {}