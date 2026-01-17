package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.ApplicationRepository;
import com.example.volunteermanagement.repository.EventRepository;
import com.example.volunteermanagement.repository.UserRepository;
import com.example.volunteermanagement.repository.WorkAreaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/applications")
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final EventRepository eventRepository;
    private final WorkAreaRepository workAreaRepository;

    // --- ÖNKÉNTESEKNEK ---

    @PostMapping
    @PreAuthorize("hasAuthority('VOLUNTEER') or hasAuthority('COORDINATOR') or hasAuthority('ORGANIZER') or hasAuthority('SYS_ADMIN')")
    public ResponseEntity<?> applyForEvent(@RequestParam Long eventId, @RequestParam Long workAreaId, Principal principal) {
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User nem található"));

        if (applicationRepository.findByUserAndEventId(user, eventId).isPresent()) {
            return ResponseEntity.badRequest().body("Már jelentkeztél erre az eseményre!");
        }

        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Esemény nem található"));

        WorkArea workArea = workAreaRepository.findById(workAreaId)
                .orElseThrow(() -> new RuntimeException("Munkaterület nem található"));

        Application application = Application.builder()
                .user(user)
                .event(event)
                .workArea(workArea)
                .status(ApplicationStatus.PENDING)
                .appliedAt(LocalDateTime.now())
                .build();

        applicationRepository.save(application);
        return ResponseEntity.ok("Sikeres jelentkezés!");
    }

    @GetMapping("/my")
    public ResponseEntity<List<Application>> getMyApplications(Principal principal) {
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User nem található"));
        return ResponseEntity.ok(applicationRepository.findByUser(user));
    }

    @GetMapping("/work-areas/{eventId}")
    public ResponseEntity<List<WorkArea>> getWorkAreasForEvent(@PathVariable Long eventId) {
        return ResponseEntity.ok(workAreaRepository.findByEventId(eventId));
    }

    // --- KOORDINÁTOROKNAK / SZERVEZŐKNEK (ÚJ RÉSZ) ---

    // 1. Jelentkezők listázása egy eseményhez
    @GetMapping("/event/{eventId}")
    @PreAuthorize("hasAnyAuthority('COORDINATOR', 'ORGANIZER', 'SYS_ADMIN')")
    public ResponseEntity<List<Application>> getApplicationsByEvent(@PathVariable Long eventId) {
        return ResponseEntity.ok(applicationRepository.findByEventId(eventId));
    }

    // 2. Státusz módosítása (Elfogadás / Elutasítás)
    @PutMapping("/{applicationId}/status")
    @PreAuthorize("hasAnyAuthority('COORDINATOR', 'ORGANIZER', 'SYS_ADMIN')")
    public ResponseEntity<?> updateApplicationStatus(@PathVariable Long applicationId, @RequestParam ApplicationStatus status) {
        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new RuntimeException("Jelentkezés nem található"));

        application.setStatus(status);
        applicationRepository.save(application);

        return ResponseEntity.ok("Státusz frissítve: " + status);
    }
}