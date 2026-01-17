package com.example.volunteermanagement.dto;

import com.example.volunteermanagement.model.Role;

// Ez az osztály csak arra jó, hogy biztonságosan küldjünk adatokat a frontendnek
public record UserDTO(
        Long id,
        String name,
        String email,
        Role role
) {}