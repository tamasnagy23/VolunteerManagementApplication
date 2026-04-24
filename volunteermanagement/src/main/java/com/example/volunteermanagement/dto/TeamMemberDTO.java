package com.example.volunteermanagement.dto;

import java.util.List;

public record TeamMemberDTO(
        Long id,
        String name,
        String email,
        String globalRole,
        String phoneNumber,
        String profileImageUrl, // <-- KÉP HOZZÁADVA IDE IS!
        List<OrgMembershipDTO> organizations
) {}