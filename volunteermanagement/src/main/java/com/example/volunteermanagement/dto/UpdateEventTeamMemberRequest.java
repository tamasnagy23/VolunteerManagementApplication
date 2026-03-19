package com.example.volunteermanagement.dto;

import java.util.List;

public record UpdateEventTeamMemberRequest(
        String eventRole, // "ORGANIZER", "COORDINATOR", vagy null (ha lefokozzuk)
        List<String> permissions,
        List<Long> coordinatedWorkAreaIds
) {}