package com.example.volunteermanagement.service;

import com.example.volunteermanagement.config.JwtService;
import com.example.volunteermanagement.controller.auth.AuthenticationRequest;
import com.example.volunteermanagement.controller.auth.AuthenticationResponse;
import com.example.volunteermanagement.dto.RegisterRequest;
import com.example.volunteermanagement.controller.auth.RegisterOrgRequest;
import com.example.volunteermanagement.model.Organization;
import com.example.volunteermanagement.model.OrganizationMember;
import com.example.volunteermanagement.model.OrganizationRole;
import com.example.volunteermanagement.model.MembershipStatus;
import com.example.volunteermanagement.model.Role;
import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.repository.OrganizationMemberRepository;
import com.example.volunteermanagement.repository.OrganizationRepository;
import com.example.volunteermanagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationMemberRepository organizationMemberRepository;

    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final AuditLogService auditLogService; // <-- ÚJ: Audit Logger behozva!

    // --- 1. ÖNKÉNTES REGISZTRÁCIÓJA ---
    @Transactional
    public AuthenticationResponse register(RegisterRequest request) {

        if (!request.acceptGdpr() || !request.acceptTerms()) {
            throw new RuntimeException("Az ÁSZF és a GDPR elfogadása kötelező!");
        }

        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new RuntimeException("Ezzel az email címmel már regisztráltak!");
        }

        var user = User.builder()
                .name(request.name())
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .role(Role.USER)
                .phoneNumber(request.phoneNumber())
                .gender(request.gender())
                .dateOfBirth(request.dateOfBirth())
                .termsAcceptedAt(LocalDateTime.now())
                .build();

        userRepository.save(user);

        // --- ÚJ: REGISZTRÁCIÓ NAPLÓZÁSA ---
        auditLogService.logAction(
                user.getEmail(),
                "USER_REGISTERED",
                "Saját fiók",
                "Sikeres önkéntes regisztráció a platformra.",
                null // Rendszerszintű esemény, nincs orgId
        );

        var jwtToken = jwtService.generateToken(user);
        return AuthenticationResponse.builder()
                .token(jwtToken)
                .role(user.getRole())
                .build();
    }

    // --- 2. BEJELENTKEZÉS ---
    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );
        var user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Érvénytelen email vagy jelszó"));

        // --- ÚJ: BEJELENTKEZÉS NAPLÓZÁSA ---
        auditLogService.logAction(
                user.getEmail(),
                "USER_LOGIN",
                "Rendszer",
                "Sikeres bejelentkezés.",
                null
        );

        var jwtToken = jwtService.generateToken(user);
        return AuthenticationResponse.builder()
                .token(jwtToken)
                .role(user.getRole())
                .build();
    }

    // --- 3. SZERVEZET ÉS TULAJDONOS REGISZTRÁLÁSA ---
    @Transactional
    public AuthenticationResponse registerOrganization(RegisterOrgRequest request) {

        if (!request.isAcceptGdpr() || !request.isAcceptTerms()) {
            throw new RuntimeException("Az ÁSZF és a GDPR elfogadása kötelező!");
        }

        if (userRepository.findByEmail(request.getAdminEmail()).isPresent()) {
            throw new RuntimeException("Ezzel az email címmel már regisztráltak!");
        }

        // Szervezet mentése
        Organization org = Organization.builder()
                .name(request.getOrgName())
                .address(request.getOrgAddress())
                .cui(request.getOrgCui())
                .description(request.getDescription())
                .email(request.getEmail())
                .phone(request.getPhone())
                .inviteCode(UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .build();
        Organization savedOrg = organizationRepository.save(org);

        // Admin mentése
        User admin = User.builder()
                .name(request.getAdminName())
                .email(request.getAdminEmail())
                .password(passwordEncoder.encode(request.getAdminPassword()))
                .role(Role.USER)
                .termsAcceptedAt(LocalDateTime.now())
                .build();
        userRepository.save(admin);

        // Tagság mentése
        OrganizationMember membership = OrganizationMember.builder()
                .user(admin)
                .organization(savedOrg)
                .role(OrganizationRole.OWNER)
                .status(MembershipStatus.APPROVED)
                .joinedAt(LocalDateTime.now())
                .build();
        organizationMemberRepository.save(membership);

        // --- ÚJ: KOMPLEX NAPLÓZÁS ---
        // 1. Felhasználó regisztrációja (Rendszerszintű)
        auditLogService.logAction(
                admin.getEmail(),
                "USER_REGISTERED",
                "Saját fiók",
                "Sikeres vezetői regisztráció.",
                null
        );

        // 2. Szervezet létrehozása (Szervezeti szintű)
        auditLogService.logAction(
                admin.getEmail(),
                "ORG_CREATED",
                "Szervezet: " + savedOrg.getName(),
                "Új szervezet regisztrálva a rendszerben.",
                savedOrg.getId()
        );

        // 3. Automatikus alapítói kinevezés (Szervezeti szintű)
        auditLogService.logAction(
                admin.getEmail(),
                "ROLE_ASSIGNED",
                "Automatikus kinevezés",
                "A felhasználó megkapta az OWNER (Alapító) jogosultságot.",
                savedOrg.getId()
        );

        var jwtToken = jwtService.generateToken(admin);
        return AuthenticationResponse.builder()
                .token(jwtToken)
                .role(admin.getRole())
                .build();
    }
}