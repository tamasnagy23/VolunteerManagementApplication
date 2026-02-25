package com.example.volunteermanagement.controller.auth;

import com.example.volunteermanagement.dto.RegisterRequest; // <-- JAVÍTÁS: A DTO mappából importáljuk!
import com.example.volunteermanagement.service.AuthService;
import jakarta.validation.Valid; // <-- ÚJ IMPORT a validációhoz
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthenticationController {

    private final AuthService service;

    @PostMapping("/register")
    public ResponseEntity<AuthenticationResponse> register(
            // A @Valid mondja meg a Springnek, hogy ellenőrizze a DTO-ban lévő szabályokat (GDPR, dátum, stb.)
            @Valid @RequestBody RegisterRequest request
    ) {
        return ResponseEntity.ok(service.register(request));
    }

    @PostMapping("/authenticate")
    public ResponseEntity<AuthenticationResponse> authenticate(
            @RequestBody AuthenticationRequest request
    ) {
        return ResponseEntity.ok(service.authenticate(request));
    }

    @PostMapping("/register-org")
    public ResponseEntity<AuthenticationResponse> registerOrganization(
            @RequestBody RegisterOrgRequest request
    ) {
        return ResponseEntity.ok(service.registerOrganization(request));
    }
}