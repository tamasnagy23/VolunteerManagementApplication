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
import com.example.volunteermanagement.tenant.TenantContext; // <--- ÚJ IMPORT
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
    private final AuditLogService auditLogService;

    private final TenantProvisioningService tenantProvisioningService;

    @Transactional
    public AuthenticationResponse register(RegisterRequest request) {
        // --- JAVÍTÁS: Kényszerítjük a Mester adatbázist ---
        TenantContext.clear();

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

        auditLogService.logAction(
                user.getEmail(),
                "USER_REGISTERED",
                "Saját fiók",
                "Sikeres önkéntes regisztráció a platformra.",
                null
        );

        var jwtToken = jwtService.generateToken(user);
        return AuthenticationResponse.builder()
                .token(jwtToken)
                .role(user.getRole())
                .build();
    }

    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        // --- JAVÍTÁS: Kényszerítjük a Mester adatbázist a bejelentkezéshez ---
        TenantContext.clear();

        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );
        var user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Érvénytelen email vagy jelszó"));

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

    @Transactional
    public AuthenticationResponse registerOrganization(RegisterOrgRequest request) {
        // --- JAVÍTÁS: Kényszerítjük a Mester adatbázist ---
        TenantContext.clear();

        if (!request.isAcceptGdpr() || !request.isAcceptTerms()) {
            throw new RuntimeException("Az ÁSZF és a GDPR elfogadása kötelező!");
        }

        if (userRepository.findByEmail(request.getAdminEmail()).isPresent()) {
            throw new RuntimeException("Ezzel az email címmel már regisztráltak!");
        }

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

        String sanitizedName = request.getOrgName().toLowerCase()
                .replaceAll("[áàä]", "a").replaceAll("[éèë]", "e")
                .replaceAll("[íìï]", "i").replaceAll("[óòöő]", "o")
                .replaceAll("[úùüű]", "u")
                .replaceAll("[^a-z0-9]", "_")
                .replaceAll("_+", "_")
                .replaceAll("^_|_$", "");

        if (sanitizedName.isEmpty()) {
            sanitizedName = "org";
        }

        String newTenantId = sanitizedName + "_" + savedOrg.getId();
        String newDbName = newTenantId + "_db";

        savedOrg.setTenantId(newTenantId);
        savedOrg = organizationRepository.save(savedOrg);

        User admin = User.builder()
                .name(request.getAdminName())
                .email(request.getAdminEmail())
                .password(passwordEncoder.encode(request.getAdminPassword()))
                .role(Role.USER)
                .termsAcceptedAt(LocalDateTime.now())
                .build();
        User savedAdmin = userRepository.save(admin);

        OrganizationMember membership = OrganizationMember.builder()
                .user(savedAdmin)
                .organization(savedOrg)
                .role(OrganizationRole.OWNER)
                .status(MembershipStatus.APPROVED)
                .joinedAt(LocalDateTime.now())
                .build();
        OrganizationMember savedMembership = organizationMemberRepository.save(membership);

        tenantProvisioningService.createNewTenantDatabase(newTenantId, newDbName, savedOrg, savedAdmin, savedMembership);

        auditLogService.logAction(admin.getEmail(), "USER_REGISTERED", "Saját fiók", "Sikeres vezetői regisztráció.", null);

        auditLogService.logActionWithOrgName(
                admin.getEmail(),
                "ORG_CREATED",
                "Szervezet: " + savedOrg.getName(),
                "Új szervezet regisztrálva.",
                savedOrg.getId(),
                savedOrg.getName()
        );

        auditLogService.logActionWithOrgName(
                admin.getEmail(),
                "ROLE_ASSIGNED",
                "Automatikus kinevezés",
                "OWNER jogosultság megadva.",
                savedOrg.getId(),
                savedOrg.getName()
        );

        var jwtToken = jwtService.generateToken(savedAdmin);
        return AuthenticationResponse.builder()
                .token(jwtToken)
                .role(savedAdmin.getRole())
                .build();
    }
}