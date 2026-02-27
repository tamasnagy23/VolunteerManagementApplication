package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.ApplicationSubmitDTO;
import com.example.volunteermanagement.dto.PendingApplicationDTO;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/applications")
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final EventRepository eventRepository;
    private final WorkAreaRepository workAreaRepository;

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public ResponseEntity<?> applyForEvent(@RequestBody ApplicationSubmitDTO request, Principal principal) {
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));

        Event event = eventRepository.findById(request.eventId())
                .orElseThrow(() -> new RuntimeException("Esemény nem található"));

        List<WorkArea> preferredAreas = workAreaRepository.findAllById(request.preferredWorkAreaIds());
        if (preferredAreas.isEmpty()) {
            return ResponseEntity.badRequest().body("Legalább egy munkaterületet ki kell választanod!");
        }

        // ÚJ LOGIKA: Minden kiválasztott területhez egy KÜLÖN jelentkezést (jegyet) hozunk létre!
        List<Application> applicationsToSave = new ArrayList<>();

        for (WorkArea wa : preferredAreas) {

            // Extra ellenőrzés: jelentkezett-e már KIFEJEZETTEN ERRE a területre?
            boolean alreadyAppliedToThisArea = applicationRepository.findByUserAndEventId(user, event.getId())
                    .stream()
                    .anyMatch(app -> app.getAssignedWorkArea() != null && app.getAssignedWorkArea().getId().equals(wa.getId()));

            if (alreadyAppliedToThisArea) {
                continue; // Ezt átugorjuk, ha ide már van jegye
            }

            Application application = Application.builder()
                    .user(user)
                    .event(event)
                    .assignedWorkArea(wa) // Rögtön beosztottként mentjük, hogy különálló legyen!
                    .preferredWorkAreas(List.of(wa))
                    .status(ApplicationStatus.PENDING)
                    .appliedAt(LocalDateTime.now())
                    .build();

            // Válaszok csatolása az aktuális "jegyhez"
            if (request.answers() != null && !request.answers().isEmpty()) {
                List<ApplicationAnswer> answersList = new ArrayList<>();
                for (EventQuestion q : event.getQuestions()) {
                    if (request.answers().containsKey(q.getId())) {
                        answersList.add(ApplicationAnswer.builder()
                                .application(application)
                                .question(q)
                                .answerText(request.answers().get(q.getId()))
                                .build());
                    }
                }
                application.setAnswers(answersList);
            }
            applicationsToSave.add(application);
        }

        if (applicationsToSave.isEmpty()) {
            return ResponseEntity.badRequest().body("Ezekre a területekre már jelentkeztél!");
        }

        applicationRepository.saveAll(applicationsToSave);
        return ResponseEntity.ok("Sikeres jelentkezés!");
    }

    @GetMapping("/my")
    @Transactional(readOnly = true)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<PendingApplicationDTO>> getMyApplications(Principal principal) {
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));

        List<PendingApplicationDTO> dtos = applicationRepository.findByUser(user).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/event/{eventId}")
    @Transactional(readOnly = true)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getApplicationsByEvent(@PathVariable("eventId") Long eventId, Principal principal) {
        User user = userRepository.findByEmail(principal.getName()).orElseThrow();
        Event event = eventRepository.findById(eventId).orElseThrow(() -> new RuntimeException("Esemény nem található"));

        boolean isGlobalAdmin = user.getRole() == Role.SYS_ADMIN;
        boolean isOrgAdmin = user.getMemberships().stream()
                .anyMatch(m -> m.getOrganization().getId().equals(event.getOrganization().getId())
                        && m.getStatus() == MembershipStatus.APPROVED
                        && (m.getRole() == OrganizationRole.ORGANIZER || m.getRole() == OrganizationRole.OWNER));

        if (!isGlobalAdmin && !isOrgAdmin) {
            return ResponseEntity.status(403).body("Nincs jogosultságod a jelentkezők megtekintéséhez ezen az eseményen.");
        }

        List<PendingApplicationDTO> dtos = applicationRepository.findByEventId(eventId).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @PutMapping("/{applicationId}/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> updateApplicationStatus(
            @PathVariable("applicationId") Long applicationId,
            @RequestParam("status") ApplicationStatus status,
            Principal principal) {

        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));

        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new RuntimeException("Jelentkezés nem található"));

        Event event = application.getEvent();

        // JAVÍTÁS: Kifejtettük a jogosultság ellenőrzést
        boolean isOwner = application.getUser().getId().equals(user.getId());

        boolean isGlobalAdmin = user.getRole() == Role.SYS_ADMIN;

        boolean isOrgAdmin = user.getMemberships().stream()
                .anyMatch(m -> m.getOrganization().getId().equals(event.getOrganization().getId())
                        && m.getStatus() == MembershipStatus.APPROVED
                        && (m.getRole() == OrganizationRole.ORGANIZER || m.getRole() == OrganizationRole.OWNER));

        boolean isAdmin = isGlobalAdmin || isOrgAdmin;

        // 1. Ha az ÖNKÉNTES akarja módosítani a sajátját (csak visszaállíthatja PENDING-re)
        if (isOwner && !isAdmin) {
            if (status == ApplicationStatus.PENDING) {
                application.setStatus(status);
                applicationRepository.save(application);
                return ResponseEntity.ok("Sikeres visszajelentkezés!");
            }
            return ResponseEntity.status(403).body("Nincs jogod ehhez a művelethez!");
        }

        // 2. Ha az ADMIN akarja módosítani
        if (isAdmin) {
            application.setStatus(status);
            applicationRepository.save(application);
            return ResponseEntity.ok("Státusz frissítve.");
        }

        return ResponseEntity.status(403).body("Nincs jogosultságod a státusz módosításához!");
    }

    // JAVÍTÁS: DTO Mappelés frissítése az új adatstruktúrához
    private PendingApplicationDTO mapToDTO(Application app) {
        String eventOrgName = (app.getEvent() != null && app.getEvent().getOrganization() != null)
                ? app.getEvent().getOrganization().getName() : "Ismeretlen szervezet";

        Long eventOrgId = (app.getEvent() != null && app.getEvent().getOrganization() != null)
                ? app.getEvent().getOrganization().getId() : null;

        Long eventId = app.getEvent() != null ? app.getEvent().getId() : null;
        String eventTitle = app.getEvent() != null ? app.getEvent().getTitle() : "Ismeretlen esemény";

        String displayAreaName = "Nincs terület megadva";
        Long displayAreaId = null;

        if (app.getAssignedWorkArea() != null) {
            displayAreaId = app.getAssignedWorkArea().getId();
            displayAreaName = app.getAssignedWorkArea().getName();
        }
        else if (app.getPreferredWorkAreas() != null && !app.getPreferredWorkAreas().isEmpty()) {
            displayAreaName = app.getPreferredWorkAreas().stream()
                    .map(WorkArea::getName)
                    .collect(Collectors.joining(", "));
            displayAreaId = app.getPreferredWorkAreas().get(0).getId();
        }

        // --- ÚJ RÉSZ: Válaszok összegyűjtése a DTO számára ---
        java.util.Map<String, String> answersMap = new java.util.HashMap<>();
        if (app.getAnswers() != null) {
            for (ApplicationAnswer answer : app.getAnswers()) {
                // A kulcs a kérdés szövege, az érték az önkéntes válasza
                answersMap.put(answer.getQuestion().getQuestionText(), answer.getAnswerText());
            }
        }
        // ----------------------------------------------------

        return new PendingApplicationDTO(
                app.getId(),
                app.getUser() != null ? app.getUser().getName() : "Névtelen",
                app.getUser() != null ? app.getUser().getEmail() : "Nincs email",
                app.getUser() != null ? app.getUser().getPhoneNumber() : "Nincs telefon",
                eventOrgName,
                eventOrgId,
                displayAreaId,
                displayAreaName,
                app.getStatus(),
                eventId,
                eventTitle,
                answersMap // ÁTADJUK A VÁLASZOKAT (Ez a 12. paraméter)
        );
    }

    // --- ÚJ: JELENTKEZÉS VISSZAVONÁSA (TÖRLÉSE) ---
    @DeleteMapping("/{applicationId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> withdrawApplication(@PathVariable("applicationId") Long applicationId, Principal principal) {
        User user = userRepository.findByEmail(principal.getName()).orElseThrow();
        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new RuntimeException("Jelentkezés nem található"));

        if (!application.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body("Csak a saját jelentkezésedet vonhatod vissza!");
        }

        // TÖRLÉS HELYETT: Státusz átírása
        application.setStatus(ApplicationStatus.WITHDRAWN); // Vagy "WITHDRAWN" string
        applicationRepository.save(application);

        return ResponseEntity.ok("Jelentkezés visszavonva.");
    }
}