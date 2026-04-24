/*package com.example.volunteermanagement.config;

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
                    .tenantId("org_1")
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
                    .status(MembershipStatus.APPROVED)
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
                    .capacity(10)
                    .build();
            workAreaRepository.save(bar);

            System.out.println("--- DEMO ADATOK LÉTREHOZVA ---");
        }
    }}*/

package com.example.volunteermanagement.config; // Figyelj, hogy a csomagnév a tiéd legyen!

import com.example.volunteermanagement.model.Role;
import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        // CSAK A RENDSZERGAZDÁT HOZZUK LÉTRE (ha még nem létezik)
        if (userRepository.findByEmail("sysadmin@test.com").isEmpty()) {
            User sysAdmin = User.builder()
                    .name("Fő Rendszergazda")
                    .email("sysadmin@test.com")
                    .password(passwordEncoder.encode("admin123")) // Írd át, ha más volt a teszt jelszavad!
                    .role(Role.SYS_ADMIN)
                    .termsAcceptedAt(LocalDateTime.now())
                    .build();

            userRepository.save(sysAdmin);
            System.out.println("✅ Mester-teszt fiók (SYS_ADMIN) sikeresen inicializálva!");
        }

        // SEMMI MÁST NEM HOZUNK LÉTRE ITT!
        // A szervezeteket mostantól a felületen (UI) keresztül kell regisztrálni,
        // hogy lefusson a dinamikus PostgreSQL adatbázis-generálás!
    }
}