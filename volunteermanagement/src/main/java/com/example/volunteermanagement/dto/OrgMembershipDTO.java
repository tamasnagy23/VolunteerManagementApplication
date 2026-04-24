package com.example.volunteermanagement.dto;

public record   OrgMembershipDTO(
        Long orgId,
        String orgName,
        String orgRole,
        String tenantId,
        String status,
        String rejectionMessage
) {}