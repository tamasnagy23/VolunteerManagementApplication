package com.example.volunteermanagement.service;

import com.example.volunteermanagement.config.JwtService;
import com.example.volunteermanagement.dto.AuthRequest;
import com.example.volunteermanagement.dto.AuthResponse;
import com.example.volunteermanagement.dto.RegisterRequest;
import com.example.volunteermanagement.model.Role;
import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthenticationService {

    private final UserRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public AuthResponse register(RegisterRequest request) {
        // Ellenőrizzük, létezik-e már az email
        if (repository.findByEmail(request.email()).isPresent()) {
            throw new RuntimeException("Ez az email cím már foglalt");
        }

        var user = User.builder()
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                // Alapértelmezetten mindenki VOLUNTEER.
                // Ha Admint akarsz, azt vagy adatbázisban írod át kézzel, vagy külön logikával.
                .role(Role.VOLUNTEER)
                .build();

        repository.save(user);
        var jwtToken = jwtService.generateToken(user);
        return new AuthResponse(jwtToken);
    }

    public AuthResponse authenticate(AuthRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );
        var user = repository.findByEmail(request.email())
                .orElseThrow();
        var jwtToken = jwtService.generateToken(user);
        return new AuthResponse(jwtToken);
    }
}