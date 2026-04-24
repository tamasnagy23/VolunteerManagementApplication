package com.example.volunteermanagement.dto;

import com.example.volunteermanagement.model.Role;
import java.util.List;

public record UserDTO(
        Long id,
        String name,
        String email,
        Role role,
        String phoneNumber,
        String profileImageUrl, // <--- ÚJ MEZŐ: Profilkép URL
        List<OrgMembershipDTO> memberships,
        UserStatsDTO stats
) {}