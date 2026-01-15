package com.example.volunteermanagement.dto;

import com.example.volunteermanagement.model.AssignmentStatus;
import jakarta.validation.constraints.NotNull;

public record ChangeStatusRequest(
        @NotNull(message = "Az új státusz megadása kötelező")
        AssignmentStatus status
) {}