package com.example.volunteermanagement.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class EventPermissionsDTO {
    private boolean isGlobalAdmin;         // Globális admin-e? (Ő mindent lát)
    private String eventRole;              // ORGANIZER, COORDINATOR, vagy null (ha sima önkéntes)
    private List<String> permissions;      // A plecsnik listája (pl. ["MANAGE_SHIFTS", "MANAGE_APPLICATIONS"])
    private List<Long> coordinatedWorkAreas; // Melyik Munkaterületeknek ő a konkrét vezetője (ID lista)
}