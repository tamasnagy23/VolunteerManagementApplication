package com.example.volunteermanagement.config;

import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.EventRepository;
import com.example.volunteermanagement.repository.OrganizationRepository;
import com.example.volunteermanagement.repository.UserRepository;
import com.example.volunteermanagement.repository.WorkAreaRepository;
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
    private final PasswordEncoder passwordEncoder;
    private final EventRepository eventRepository;
    private final WorkAreaRepository workAreaRepository;

    @Override
    public void run(String... args) throws Exception {
        // Csak akkor fut le, ha még nincs szervezet az adatbázisban
        if (organizationRepository.count() == 0) {

            // 1. Létrehozunk egy Szervezetet
            Organization org = Organization.builder()
                    .name("Sziget Fesztivál Szervezőiroda")
                    .inviteCode("SZIGET2026")
                    .build();
            organizationRepository.save(org);

            // 2. Létrehozunk egy Szervezőt (ORGANIZER) - Ő tartozik a szervezethez
            User organizer = User.builder()
                    .name("Főszervező Ferenc")
                    .email("admin@sziget.hu")
                    .password(passwordEncoder.encode("password"))
                    .role(Role.ORGANIZER)
                    .organization(org) // Neki beállítjuk a szervezetet
                    .build();
            userRepository.save(organizer);

            // 3. Létrehozunk egy Rendszergazdát (SYS_ADMIN) - Neki NINCS szervezete
            User sysAdmin = User.builder()
                    .name("Super Admin")
                    .email("sysadmin@test.com")
                    .password(passwordEncoder.encode("admin123"))
                    .role(Role.SYS_ADMIN)
                    .organization(null) // Ez a kulcs! Mivel a @JoinColumn engedi a NULL-t.
                    .build();
            userRepository.save(sysAdmin);

            Event szigetEvent = Event.builder()
                    .title("Sziget Fesztivál 2026")
                    .description("A szabadság szigete")
                    .location("Budapest, Hajógyári sziget")
                    .organization(org)
                    .startTime(LocalDateTime.of(2026, 8, 10, 12, 0))
                    .endTime(LocalDateTime.of(2026, 8, 17, 12, 0))
                    .build();
            eventRepository.save(szigetEvent);

            // 5. Létrehozunk Munkaterületeket az eseményhez
            WorkArea bar = WorkArea.builder()
                    .name("Pultos")
                    .description("Italok kiszolgálása a nagyszínpadnál")
                    .event(szigetEvent)
                    .build();
            workAreaRepository.save(bar); // Kell hozzá: private final WorkAreaRepository workAreaRepository;

            WorkArea security = WorkArea.builder()
                    .name("Jegyellenőr")
                    .description("Karszalagok ellenőrzése a bejáratnál")
                    .event(szigetEvent)
                    .build();
            workAreaRepository.save(security);

            System.out.println("--- DEMO ADATOK LÉTREHOZVA ---");
            System.out.println("Szervező: admin@sziget.hu / password");
            System.out.println("Rendszergazda: sysadmin@test.com / admin123");
        }
    }
}