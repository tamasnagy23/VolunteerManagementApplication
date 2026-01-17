package com.example.volunteermanagement.service;

import com.example.volunteermanagement.config.JwtService;
import com.example.volunteermanagement.controller.auth.AuthenticationRequest;
import com.example.volunteermanagement.controller.auth.AuthenticationResponse;
import com.example.volunteermanagement.controller.auth.RegisterRequest;
import com.example.volunteermanagement.model.Role;
import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.repository.OrganizationRepository;
import com.example.volunteermanagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    // EZ HIÁNYZOTT: Be kell injektálni a repository-t!
    private final OrganizationRepository organizationRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public AuthenticationResponse register(RegisterRequest request) {

        // 1. Megkeressük a szervezetet a kód alapján
        var organization = organizationRepository.findByInviteCode(request.getInviteCode())
                .orElseThrow(() -> new RuntimeException("Érvénytelen meghívókód! Ellenőrizd a kódot."));

        // 2. Létrehozzuk a felhasználót
        var user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.VOLUNTEER) // Alapból mindenki önkéntes, aki kóddal jön
                .organization(organization) // Hozzárendeljük a szervezethez
                .build();

        userRepository.save(user);

        var jwtToken = jwtService.generateToken(user);
        return AuthenticationResponse.builder()
                .token(jwtToken)
                .role(user.getRole())
                .build();
    }

    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );
        var user = userRepository.findByEmail(request.getEmail())
                .orElseThrow();
        var jwtToken = jwtService.generateToken(user);
        return AuthenticationResponse.builder()
                .token(jwtToken)
                .role(user.getRole())
                .build();
    }
}