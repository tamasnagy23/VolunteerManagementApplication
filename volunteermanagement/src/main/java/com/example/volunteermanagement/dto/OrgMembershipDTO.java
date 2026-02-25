package com.example.volunteermanagement.dto;

public record OrgMembershipDTO(
        Long orgId,
        String orgName,
        String orgRole,
        String status
) {}