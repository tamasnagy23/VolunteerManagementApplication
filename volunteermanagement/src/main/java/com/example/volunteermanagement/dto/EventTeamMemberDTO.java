package com.example.volunteermanagement.dto;

import java.util.List;

// Valahogy így kell kinéznie az új mezőkkel:
public record EventTeamMemberDTO(
        Long userId,
        String userName,
        String userEmail,
        String phoneNumber,
        String profileImageUrl,
        String eventRole,
        List<String> permissions,
        List<Long> coordinatedWorkAreaIds,
        boolean isSysAdmin, // <-- ÚJ
        String orgRole      // <-- ÚJ
) {}