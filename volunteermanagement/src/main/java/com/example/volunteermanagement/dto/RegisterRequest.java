package com.example.volunteermanagement.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "A név nem lehet üres")
        String name,

        @NotBlank(message = "Az email nem lehet üres")
        @Email(message = "Nem érvényes email formátum")
        String email,

        @NotBlank(message = "A jelszó nem lehet üres")
        @Size(min = 6, message = "A jelszó legyen legalább 6 karakter")
        String password
) {}