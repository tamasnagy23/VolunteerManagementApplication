package com.example.volunteermanagement.dto;

import java.util.List;

public record TeamMemberDTO(
        Long id,
        String name,
        String email,
        String globalRole,
        String phoneNumber,
        List<OrgMembershipDTO> organizations
) {}