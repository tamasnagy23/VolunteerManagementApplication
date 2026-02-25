package com.example.volunteermanagement.service;

import com.example.volunteermanagement.config.JwtService;
import com.example.volunteermanagement.controller.auth.AuthenticationRequest;
import com.example.volunteermanagement.controller.auth.AuthenticationResponse;
import com.example.volunteermanagement.dto.RegisterRequest; // JAVÍTVA: A Te DTO-dat importáljuk
import com.example.volunteermanagement.controller.auth.RegisterOrgRequest;
import com.example.volunteermanagement.model.Organization;
import com.example.volunteermanagement.model.OrganizationMember;
import com.example.volunteermanagement.model.OrganizationRole;
import com.example.volunteermanagement.model.MembershipStatus; // <-- ÚJ STÁTUSZ IMPORT
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

    // --- 1. ÖNKÉNTES REGISZTRÁCIÓJA (Nyílt platform módszer) ---
    @Transactional
    public AuthenticationResponse register(RegisterRequest request) {

        // 1. Biztonsági dupla ellenőrzés (bár a DTO-ban is benne van az @AssertTrue)
        if (!request.acceptGdpr() || !request.acceptTerms()) {
            throw new RuntimeException("Az ÁSZF és a GDPR elfogadása kötelező!");
        }

        // 2. Email egyediség ellenőrzése
        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new RuntimeException("Ezzel az email címmel már regisztráltak!");
        }

        // 3. Új User létrehozása az összes új adattal (szervezeti tagság NÉLKÜL!)
        var user = User.builder()
                .name(request.name())
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .role(Role.USER) // Globálisan mindenki sima USER
                .phoneNumber(request.phoneNumber())
                .gender(request.gender())
                .dateOfBirth(request.dateOfBirth())
                .termsAcceptedAt(LocalDateTime.now()) // Eltároljuk, mikor pipálta be
                .build();

        userRepository.save(user);

        // 4. Token generálása a belépéshez
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
        var jwtToken = jwtService.generateToken(user);
        return AuthenticationResponse.builder()
                .token(jwtToken)
                .role(user.getRole())
                .build();
    }

    // --- 3. SZERVEZET ÉS TULAJDONOS REGISZTRÁLÁSA ---
    // --- 3. SZERVEZET ÉS TULAJDONOS REGISZTRÁLÁSA ---
    @Transactional
    public AuthenticationResponse registerOrganization(RegisterOrgRequest request) {

        // 1. Biztonsági ellenőrzés a szervezeteknél is!
        if (!request.isAcceptGdpr() || !request.isAcceptTerms()) {
            throw new RuntimeException("Az ÁSZF és a GDPR elfogadása kötelező!");
        }

        // 2. Email egyediség ellenőrzése az adminra
        if (userRepository.findByEmail(request.getAdminEmail()).isPresent()) {
            throw new RuntimeException("Ezzel az email címmel már regisztráltak!");
        }

        // 3. Szervezet létrehozása az ÚJ mezőkkel
        Organization org = Organization.builder()
                .name(request.getOrgName())
                .address(request.getOrgAddress())
                .cui(request.getOrgCui())
                .description(request.getDescription()) // ÚJ: Leírás
                .email(request.getEmail())             // ÚJ: Kapcsolat email
                .phone(request.getPhone())             // ÚJ: Kapcsolat telefon
                .inviteCode(UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .build();
        organizationRepository.save(org);

        // 4. Admin User létrehozása
        User admin = User.builder()
                .name(request.getAdminName())
                .email(request.getAdminEmail())
                .password(passwordEncoder.encode(request.getAdminPassword()))
                .role(Role.USER)
                .termsAcceptedAt(LocalDateTime.now()) // ÚJ: Eltároljuk az elfogadás idejét itt is!
                .build();
        userRepository.save(admin);

        // 5. Alapítói tagság létrehozása
        OrganizationMember membership = OrganizationMember.builder()
                .user(admin)
                .organization(org)
                .role(OrganizationRole.OWNER)
                .status(MembershipStatus.APPROVED) // AZ ALAPÍTÓ AZONNAL APPROVED LESZ!
                .joinedAt(LocalDateTime.now())
                .build();
        organizationMemberRepository.save(membership);

        // 6. Token generálása
        var jwtToken = jwtService.generateToken(admin);
        return AuthenticationResponse.builder()
                .token(jwtToken)
                .role(admin.getRole())
                .build();
    }
}