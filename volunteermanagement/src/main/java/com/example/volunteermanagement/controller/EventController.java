package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.EventDTO;
import com.example.volunteermanagement.service.EventSecurityService;
import com.example.volunteermanagement.dto.EventPermissionsDTO;
import com.example.volunteermanagement.dto.ShiftDTO;
import com.example.volunteermanagement.dto.WorkAreaDTO;
import com.example.volunteermanagement.model.Event;
import com.example.volunteermanagement.service.EventService;
import com.example.volunteermanagement.service.EventTeamService;
import com.example.volunteermanagement.service.ShiftService;
import com.example.volunteermanagement.service.FileStorageService;
import com.example.volunteermanagement.repository.EventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;
    private final FileStorageService fileStorageService;
    private final EventRepository eventRepository;

    @Autowired
    private ShiftService shiftService;

    @Autowired
    private EventSecurityService eventSecurityService;

    @Autowired
    private EventTeamService eventTeamService;

    // JAVÍTVA: Mivel a Service már EventDTO-t ad vissza, egyből ezt adjuk a ResponseEntity-nek!
    @PostMapping
    @PreAuthorize("@eventSecurity.canCreateEventForOrg(authentication.name, #eventDTO.organization.id)")
    public ResponseEntity<EventDTO> createEvent(@RequestBody EventDTO eventDTO, Principal principal) {
        EventDTO createdEvent = eventService.createEventWithWorkAreas(eventDTO, principal.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(createdEvent);
    }

    @GetMapping("/public")
    public ResponseEntity<Page<EventDTO>> getPublicEvents(Pageable pageable) {
        return ResponseEntity.ok(eventService.getPublicEventsFromMaster(pageable));
    }

    @GetMapping
    public ResponseEntity<Page<EventDTO>> getAllEvents(
            @RequestParam(required = false) Long orgId,
            Pageable pageable,
            Principal principal) {
        return ResponseEntity.ok(eventService.getAllEvents(pageable, principal.getName(), orgId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<EventDTO> getEventById(@PathVariable Long id) {
        return ResponseEntity.ok(eventService.getEventDTOById(id));
    }

    // JAVÍTVA: A visszatérési típus itt most már ResponseEntity<EventDTO> a nyers Event helyett!
    @PutMapping("/{id}")
    @PreAuthorize("@eventSecurity.hasPermission(authentication.name, #id, 'EDIT_EVENT_DETAILS')")
    public ResponseEntity<EventDTO> updateEvent(@PathVariable Long id, @RequestBody EventDTO eventDTO, Principal principal) {
        return ResponseEntity.ok(eventService.updateEvent(id, eventDTO, principal.getName()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@eventSecurity.hasPermission(authentication.name, #id, 'EDIT_EVENT_DETAILS')")
    public ResponseEntity<Void> deleteEvent(@PathVariable Long id, Principal principal) {
        eventService.deleteEvent(id, principal.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/shifts")
    @PreAuthorize("@eventSecurity.canViewEventData(authentication.name, #id)")
    public ResponseEntity<List<ShiftDTO>> getEventShifts(@PathVariable Long id) {
        return ResponseEntity.ok(shiftService.getShiftsByEvent(id));
    }

    @GetMapping("/{id}/work-areas")
    public ResponseEntity<List<WorkAreaDTO>> getEventWorkAreas(@PathVariable Long id) {
        return ResponseEntity.ok(eventService.getWorkAreasByEventId(id));
    }

    @GetMapping("/my-shifts")
    public ResponseEntity<List<com.example.volunteermanagement.dto.MyShiftDTO>> getMyShifts(Principal principal) {
        return ResponseEntity.ok(shiftService.getMyShifts(principal.getName()));
    }

    @GetMapping("/{eventId}/my-permissions")
    public ResponseEntity<EventPermissionsDTO> getMyEventPermissions(
            @PathVariable Long eventId,
            Principal principal) {

        EventPermissionsDTO permissions = eventSecurityService.getMyPermissionsForEvent(principal.getName(), eventId);
        if (permissions == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(permissions);
    }

    @GetMapping("/{eventId}/team")
    @PreAuthorize("@eventSecurity.canViewEventData(authentication.name, #eventId)")
    public ResponseEntity<List<com.example.volunteermanagement.dto.EventTeamMemberDTO>> getEventTeam(@PathVariable Long eventId) {
        return ResponseEntity.ok(eventTeamService.getEventTeam(eventId));
    }

    @PutMapping("/{eventId}/team/{userId}")
    @PreAuthorize("@eventSecurity.canManageEventTeam(authentication.name, #eventId)")
    public ResponseEntity<Void> updateEventTeamMember(
            @PathVariable Long eventId,
            @PathVariable Long userId,
            @RequestBody com.example.volunteermanagement.dto.UpdateEventTeamMemberRequest request,
            Principal principal) {

        eventTeamService.updateEventTeamMember(eventId, userId, request, principal.getName());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/sync-legacy")
    public org.springframework.http.ResponseEntity<String> syncLegacyEvents() {
        String result = eventService.syncAllLegacyEventsToMaster();
        return org.springframework.http.ResponseEntity.ok(result);
    }

    // =========================================================================
    // ESEMÉNY BANNER (BORÍTÓKÉP) FELTÖLTÉSE
    // =========================================================================
    @PostMapping("/{id}/banner")
    @PreAuthorize("@eventSecurity.hasPermission(authentication.name, #id, 'EDIT_EVENT_DETAILS')")
    @Transactional
    public ResponseEntity<?> uploadEventBanner(@PathVariable Long id, @RequestParam("file") MultipartFile file) {
        try {
            Event event = eventRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Esemény nem található"));

            String fileUrl = fileStorageService.storeFile(file, "banners");
            event.setBannerUrl(fileUrl);
            eventRepository.save(event);

            eventService.updateEventInMaster(event);

            return ResponseEntity.ok(Map.of(
                    "message", "Esemény borítókép sikeresen frissítve!",
                    "imageUrl", fileUrl
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================================
    // ESEMÉNY BANNER TÖRLÉSE
    // =========================================================================
    @DeleteMapping("/{id}/banner")
    @PreAuthorize("@eventSecurity.hasPermission(authentication.name, #id, 'EDIT_EVENT_DETAILS')")
    @Transactional
    public ResponseEntity<?> deleteEventBanner(@PathVariable Long id) {
        try {
            Event event = eventRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Esemény nem található"));

            event.setBannerUrl(null);
            eventRepository.save(event);

            eventService.updateEventInMaster(event);

            return ResponseEntity.ok(Map.of("message", "Esemény borítókép sikeresen törölve!"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // =========================================================================
    // ÚJ: ELÉRHETŐSÉGEK / KAPCSOLATTARTÓK VÉGPONT
    // =========================================================================
    @GetMapping("/{id}/contacts")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<Map<String, Object>>> getEventContacts(@PathVariable Long id) {
        return ResponseEntity.ok(eventService.getEventContacts(id));
    }
}