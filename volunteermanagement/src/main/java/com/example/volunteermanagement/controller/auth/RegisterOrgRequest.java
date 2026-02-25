package com.example.volunteermanagement.controller.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class RegisterOrgRequest {
    // Szervezet adatai
    private String orgName;
    private String orgAddress;
    private String orgCui;
    private String description;
    private String email;
    private String phone;

    // Főadmin adatai
    private String adminName;
    private String adminEmail;
    private String adminPassword;
    private boolean acceptGdpr;
    private boolean acceptTerms;
}