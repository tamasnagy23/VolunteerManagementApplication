package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.ApplicationSubmitDTO;
import com.example.volunteermanagement.dto.BulkEmailRequest;
import com.example.volunteermanagement.dto.PendingApplicationDTO;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.*;
import com.example.volunteermanagement.service.AuditLogService;
import com.example.volunteermanagement.service.EmailService;
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
    private final EmailService emailService;
    private final AuditLogService auditLogService;

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

        List<Application> applicationsToSave = new ArrayList<>();

        for (WorkArea wa : preferredAreas) {
            boolean alreadyAppliedToThisArea = applicationRepository.findByUserAndEventId(user, event.getId())
                    .stream()
                    .anyMatch(app -> app.getAssignedWorkArea() != null && app.getAssignedWorkArea().getId().equals(wa.getId()));

            if (alreadyAppliedToThisArea) {
                continue;
            }

            Application application = Application.builder()
                    .user(user)
                    .event(event)
                    .assignedWorkArea(wa)
                    .preferredWorkAreas(List.of(wa))
                    .status(ApplicationStatus.PENDING)
                    .appliedAt(LocalDateTime.now())
                    .build();

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

        // --- JAVÍTVA: Megadjuk a szervezet ID-ját is (5. paraméter) ---
        auditLogService.logAction(
                principal.getName(),
                "EVENT_APPLICATION",
                "Esemény ID: " + event.getId(),
                "Sikeresen jelentkezett " + applicationsToSave.size() + " munkaterületre.",
                event.getOrganization().getId()
        );

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
    public ResponseEntity<?> getApplicationsByEvent(
            @PathVariable("eventId") Long eventId,
            @RequestParam(value = "status", required = false) ApplicationStatus status, // <-- ÚJ: Fogadjuk a státusz szűrőt
            Principal principal) {

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

        // --- ÚJ: Lekérjük mindet, de HA kaptunk státuszt a frontendről, akkor szűrünk! ---
        List<Application> applications = applicationRepository.findByEventId(eventId);

        if (status != null) {
            applications = applications.stream()
                    .filter(app -> app.getStatus() == status)
                    .collect(Collectors.toList());
        }

        List<PendingApplicationDTO> dtos = applications.stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    @PutMapping("/{applicationId}/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> updateApplicationStatus(
            @PathVariable("applicationId") Long applicationId,
            @RequestParam("status") ApplicationStatus status,
            @RequestParam(value = "rejectionMessage", required = false) String rejectionMessage,
            Principal principal) {

        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));

        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new RuntimeException("Jelentkezés nem található"));

        Event event = application.getEvent();

        boolean isOwner = application.getUser().getId().equals(user.getId());
        boolean isGlobalAdmin = user.getRole() == Role.SYS_ADMIN;
        boolean isOrgAdmin = user.getMemberships().stream()
                .anyMatch(m -> m.getOrganization().getId().equals(event.getOrganization().getId())
                        && m.getStatus() == MembershipStatus.APPROVED
                        && (m.getRole() == OrganizationRole.ORGANIZER || m.getRole() == OrganizationRole.OWNER));

        boolean isAdmin = isGlobalAdmin || isOrgAdmin;

        if (isOwner && !isAdmin) {
            if (status == ApplicationStatus.PENDING) {
                application.setStatus(status);
                application.setRejectionMessage(null);
                applicationRepository.save(application);

                // --- JAVÍTVA: 5 paraméter ---
                auditLogService.logAction(
                        principal.getName(),
                        "APPLICATION_RESUBMIT",
                        "Jelentkezés ID: " + applicationId,
                        "A felhasználó újra benyújtotta a visszavont jelentkezését.",
                        event.getOrganization().getId()
                );

                return ResponseEntity.ok("Sikeres visszajelentkezés!");
            }
            return ResponseEntity.status(403).body("Nincs jogod ehhez a művelethez!");
        }

        if (isAdmin) {
            application.setStatus(status);
            if (status == ApplicationStatus.REJECTED) {
                application.setRejectionMessage(rejectionMessage);
            } else if (status == ApplicationStatus.APPROVED) {
                application.setRejectionMessage(null);
            }
            applicationRepository.save(application);

            // --- JAVÍTVA: 5 paraméter ---
            auditLogService.logAction(
                    principal.getName(),
                    "UPDATE_APP_STATUS",
                    "Jelentkezés ID: " + applicationId,
                    "Új státusz: " + status.name() + (rejectionMessage != null && !rejectionMessage.isEmpty() ? " (Indoklás: " + rejectionMessage + ")" : ""),
                    event.getOrganization().getId()
            );

            return ResponseEntity.ok("Státusz frissítve.");
        }

        return ResponseEntity.status(403).body("Nincs jogosultságod a státusz módosításához!");
    }

    @PutMapping("/bulk-status")
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public ResponseEntity<?> updateBulkApplicationStatus(
            @RequestBody List<Long> applicationIds,
            @RequestParam("status") ApplicationStatus status,
            @RequestParam(value = "rejectionMessage", required = false) String rejectionMessage,
            Principal principal) {

        User admin = userRepository.findByEmail(principal.getName()).orElseThrow();
        boolean isGlobalAdmin = admin.getRole() == Role.SYS_ADMIN;

        List<Application> applications = applicationRepository.findAllById(applicationIds);
        int modifiedCount = 0;
        Long firstOrgId = null;

        for (Application app : applications) {
            boolean isOrgAdmin = admin.getMemberships().stream()
                    .anyMatch(m -> m.getOrganization().getId().equals(app.getEvent().getOrganization().getId())
                            && m.getStatus() == MembershipStatus.APPROVED
                            && (m.getRole() == OrganizationRole.ORGANIZER || m.getRole() == OrganizationRole.OWNER));

            if (isGlobalAdmin || isOrgAdmin) {
                app.setStatus(status);
                modifiedCount++;
                if (firstOrgId == null) firstOrgId = app.getEvent().getOrganization().getId();
            }
        }

        applicationRepository.saveAll(applications);

        // --- JAVÍTVA: 5 paraméter ---
        auditLogService.logAction(
                principal.getName(),
                "BULK_UPDATE_STATUS",
                "Érintett jelentkezések: " + modifiedCount + " db",
                "Tömeges módosítás új státuszra: " + status.name(),
                firstOrgId // Itt az első talált szervezet ID-ját használjuk (tömeges művelet általában egy eseményen belül van)
        );

        return ResponseEntity.ok("Tömeges módosítás sikeres!");
    }

    @DeleteMapping("/{applicationId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> withdrawApplication(
            @PathVariable("applicationId") Long applicationId,
            @RequestParam(value = "reason", required = false) String reason,
            Principal principal) {

        User user = userRepository.findByEmail(principal.getName()).orElseThrow();
        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new RuntimeException("Jelentkezés nem található"));

        if (!application.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body("Csak a saját jelentkezésedet vonhatod vissza!");
        }

        application.setStatus(ApplicationStatus.WITHDRAWN);
        application.setWithdrawalReason(reason);
        applicationRepository.save(application);

        // --- ÚJ LOGIKA: Munkaterület nevének kinyerése a naplóhoz ---
        String areaName = "Ismeretlen terület";
        if (application.getAssignedWorkArea() != null) {
            areaName = application.getAssignedWorkArea().getName();
        } else if (application.getPreferredWorkAreas() != null && !application.getPreferredWorkAreas().isEmpty()) {
            areaName = application.getPreferredWorkAreas().get(0).getName();
        }

        // --- NAPLÓZÁS FELOKOSÍTVA ---
        String logDetails = "A felhasználó visszavonta a jelentkezését a(z) '" + areaName + "' területről.";
        if (reason != null && !reason.trim().isEmpty()) {
            logDetails += " Indok: " + reason;
        }

        auditLogService.logAction(
                principal.getName(),
                "WITHDRAW_APPLICATION",
                "Terület: " + areaName, // Ezt látod majd a "Célpont" oszlopban
                logDetails,             // Ezt látod a "Részletek" oszlopban
                application.getEvent().getOrganization().getId()
        );

        return ResponseEntity.ok("Jelentkezés visszavonva.");
    }

    private PendingApplicationDTO mapToDTO(Application app) {
        String eventOrgName = app.getEvent() != null && app.getEvent().getOrganization() != null
                ? app.getEvent().getOrganization().getName() : "Ismeretlen szervezet";
        Long eventOrgId = app.getEvent() != null && app.getEvent().getOrganization() != null
                ? app.getEvent().getOrganization().getId() : null;
        Long eventId = app.getEvent() != null ? app.getEvent().getId() : null;
        String eventTitle = app.getEvent() != null ? app.getEvent().getTitle() : "Ismeretlen esemény";

        String displayAreaName = "Nincs terület megadva";
        Long displayAreaId = null;

        if (app.getAssignedWorkArea() != null) {
            displayAreaId = app.getAssignedWorkArea().getId();
            displayAreaName = app.getAssignedWorkArea().getName();
        } else if (app.getPreferredWorkAreas() != null && !app.getPreferredWorkAreas().isEmpty()) {
            displayAreaName = app.getPreferredWorkAreas().stream().map(WorkArea::getName).collect(Collectors.joining(", "));
            displayAreaId = app.getPreferredWorkAreas().get(0).getId();
        }

        java.util.Map<String, String> answersMap = new java.util.HashMap<>();
        if (app.getAnswers() != null) {
            for (ApplicationAnswer answer : app.getAnswers()) {
                answersMap.put(answer.getQuestion().getQuestionText(), answer.getAnswerText());
            }
        }

        String userOrgRole = "Önkéntes";
        String userJoinDate = "-";

        if (app.getUser() != null && app.getEvent() != null) {
            java.util.Optional<OrganizationMember> memberOpt = app.getUser().getMemberships().stream()
                    .filter(m -> m.getOrganization().getId().equals(app.getEvent().getOrganization().getId()))
                    .findFirst();

            if (memberOpt.isPresent()) {
                OrganizationMember m = memberOpt.get();
                userOrgRole = m.getRole() == OrganizationRole.ORGANIZER ? "Szervező" :
                        m.getRole() == OrganizationRole.OWNER ? "Tulajdonos" : "Önkéntes";

                if (m.getJoinedAt() != null) {
                    java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("yyyy. MM. dd.");
                    userJoinDate = m.getJoinedAt().format(formatter);
                }
            }
        }

        String safePhoneNumber = app.getUser() != null ? app.getUser().getPhoneNumber() : "Nincs telefon";

        if (app.getStatus() == ApplicationStatus.REJECTED || app.getStatus() == ApplicationStatus.WITHDRAWN) {
            safePhoneNumber = "Rejtett adat (GDPR)";
        }

        return new PendingApplicationDTO(
                app.getId(),
                app.getUser() != null ? app.getUser().getName() : "Névtelen",
                app.getUser() != null ? app.getUser().getEmail() : "Nincs email",
                safePhoneNumber,
                eventOrgName,
                eventOrgId,
                displayAreaId,
                displayAreaName,
                app.getStatus().name(),
                eventId,
                eventTitle,
                answersMap,
                null,
                userJoinDate,
                userOrgRole,
                app.getAdminNote(),
                app.getRejectionMessage(),
                app.getWithdrawalReason()
        );
    }

    @PutMapping("/{applicationId}/note")
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public ResponseEntity<?> updateAdminNote(
            @PathVariable("applicationId") Long applicationId,
            @RequestBody java.util.Map<String, String> payload,
            Principal principal) {

        User admin = userRepository.findByEmail(principal.getName()).orElseThrow();
        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new RuntimeException("Jelentkezés nem található"));

        Event event = application.getEvent();
        boolean isGlobalAdmin = admin.getRole() == Role.SYS_ADMIN;
        boolean isOrgAdmin = admin.getMemberships().stream()
                .anyMatch(m -> m.getOrganization().getId().equals(event.getOrganization().getId())
                        && m.getStatus() == MembershipStatus.APPROVED
                        && (m.getRole() == OrganizationRole.ORGANIZER || m.getRole() == OrganizationRole.OWNER));

        if (!isGlobalAdmin && !isOrgAdmin) {
            return ResponseEntity.status(403).body("Nincs jogosultságod megjegyzést írni!");
        }

        application.setAdminNote(payload.get("note"));
        applicationRepository.saveAndFlush(application);

        // --- JAVÍTVA: 5 paraméter ---
        auditLogService.logAction(
                principal.getName(),
                "ADMIN_NOTE_UPDATED",
                "Jelentkezés ID: " + applicationId,
                "A szervező belső megjegyzést módosított.",
                event.getOrganization().getId()
        );

        return ResponseEntity.ok("Megjegyzés sikeresen elmentve.");
    }

    @PostMapping("/bulk-email")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> sendBulkEmail(
            @RequestBody BulkEmailRequest request,
            Principal principal) {

        User admin = userRepository.findByEmail(principal.getName()).orElseThrow();
        boolean isGlobalAdmin = admin.getRole() == Role.SYS_ADMIN;

        List<Application> applications = applicationRepository.findAllById(request.applicationIds());
        List<String> bccEmails = new ArrayList<>();
        Long firstOrgId = null;

        for (Application app : applications) {
            boolean isOrgAdmin = admin.getMemberships().stream()
                    .anyMatch(m -> m.getOrganization().getId().equals(app.getEvent().getOrganization().getId())
                            && m.getStatus() == MembershipStatus.APPROVED
                            && (m.getRole() == OrganizationRole.ORGANIZER || m.getRole() == OrganizationRole.OWNER));

            if (isGlobalAdmin || isOrgAdmin) {
                bccEmails.add(app.getUser().getEmail());
                if (firstOrgId == null) firstOrgId = app.getEvent().getOrganization().getId();
            }
        }

        if (!bccEmails.isEmpty()) {
            emailService.sendBulkEmailBcc(bccEmails, request.subject(), request.message());

            // --- JAVÍTVA: 5 paraméter ---
            auditLogService.logAction(
                    principal.getName(),
                    "BULK_EMAIL_SENT",
                    "Címzettek száma: " + bccEmails.size(),
                    "Tárgy: " + request.subject(),
                    firstOrgId
            );
        }

        return ResponseEntity.ok("E-mailek elküldve " + bccEmails.size() + " címzettnek!");
    }
}