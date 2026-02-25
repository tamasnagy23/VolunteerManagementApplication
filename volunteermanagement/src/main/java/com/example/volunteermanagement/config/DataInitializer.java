package com.example.volunteermanagement.config;

import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    // --- ÚJ REPOSITORY A TAGSÁGOKHOZ ---
    private final OrganizationMemberRepository organizationMemberRepository;
    private final PasswordEncoder passwordEncoder;
    private final EventRepository eventRepository;
    private final WorkAreaRepository workAreaRepository;

    @Override
    public void run(String... args) throws Exception {
        if (organizationRepository.count() == 0) {

            // 1. Szervezet létrehozása
            Organization org = Organization.builder()
                    .name("Sziget Fesztivál Szervezőiroda")
                    .inviteCode("SZIGET2026")
                    .build();
            organizationRepository.save(org);

            // 2. Felhasználó létrehozása (Globálisan most már csak USER!)
            User organizer = User.builder()
                    .name("Főszervező Ferenc")
                    .email("admin@sziget.hu")
                    .password(passwordEncoder.encode("password"))
                    .role(Role.USER) // JAVÍTÁS: ORGANIZER helyett USER
                    .build();
            userRepository.save(organizer);

            // 3. Összekötés: Itt kapja meg a tényleges hatalmát (OWNER rang a szervezetben)
            OrganizationMember membership = OrganizationMember.builder()
                    .user(organizer)
                    .organization(org)
                    .role(OrganizationRole.OWNER)
                    .joinedAt(LocalDateTime.now())
                    .build();
            organizationMemberRepository.save(membership);

            // 4. Rendszergazda (SYS_ADMIN marad, mert ez egy globális rang)
            User sysAdmin = User.builder()
                    .name("Super Admin")
                    .email("sysadmin@test.com")
                    .password(passwordEncoder.encode("admin123"))
                    .role(Role.SYS_ADMIN)
                    .build();
            userRepository.save(sysAdmin);

            // --- ESEMÉNYEK ÉS MUNKATERÜLETEK ---
            Event szigetEvent = Event.builder()
                    .title("Sziget Fesztivál 2026")
                    .description("A szabadság szigete")
                    .location("Budapest, Hajógyári sziget")
                    .organization(org)
                    .startTime(LocalDateTime.of(2026, 8, 10, 12, 0))
                    .endTime(LocalDateTime.of(2026, 8, 17, 12, 0))
                    .build();
            eventRepository.save(szigetEvent);

            // Itt korábban WorkArea-t használtál, de a legutóbbi Service kódunkban Shift-eket emlegettünk.
            // Ha még WorkArea a modelled, ez maradjon így:
            WorkArea bar = WorkArea.builder()
                    .name("Pultos")
                    .description("Italok kiszolgálása a nagyszínpadnál")
                    .event(szigetEvent)
                    .build();
            workAreaRepository.save(bar);

            System.out.println("--- DEMO ADATOK LÉTREHOZVA ---");
        }
    }}