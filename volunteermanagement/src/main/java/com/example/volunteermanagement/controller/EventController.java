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
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    @Autowired
    private ShiftService shiftService;

    @Autowired
    private EventSecurityService eventSecurityService;

    @Autowired
    private EventTeamService eventTeamService;

    @PostMapping
    // OKOS ZÁR: Csak a szervezet jogosult tagjai hozhatnak létre eseményt!
    @PreAuthorize("@eventSecurity.canCreateEventForOrg(authentication.name, #eventDTO.organizationId)")
    public ResponseEntity<EventDTO> createEvent(@RequestBody EventDTO eventDTO, Principal principal) {
        Event createdEvent = eventService.createEventWithWorkAreas(eventDTO, principal.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(eventService.getEventDTOById(createdEvent.getId()));
    }

    @GetMapping
    public ResponseEntity<Page<EventDTO>> getAllEvents(Pageable pageable, Principal principal) {
        return ResponseEntity.ok(eventService.getAllEvents(pageable, principal.getName()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<EventDTO> getEventById(@PathVariable Long id) {
        return ResponseEntity.ok(eventService.getEventDTOById(id));
    }

    // --- JAVÍTVA: Principal hozzáadva a módosításhoz ---
    @PutMapping("/{id}")
    @PreAuthorize("@eventSecurity.hasPermission(authentication.name, #id, 'EDIT_EVENT_DETAILS')")
    public ResponseEntity<Event> updateEvent(@PathVariable Long id, @RequestBody EventDTO eventDTO, Principal principal) {
        return ResponseEntity.ok(eventService.updateEvent(id, eventDTO, principal.getName()));
    }

    // --- JAVÍTVA: Principal hozzáadva a törléshez ---
    @DeleteMapping("/{id}")
    @PreAuthorize("@eventSecurity.hasPermission(authentication.name, #id, 'EDIT_EVENT_DETAILS')")
    public ResponseEntity<Void> deleteEvent(@PathVariable Long id, Principal principal) {
        eventService.deleteEvent(id, principal.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/shifts")
    public ResponseEntity<List<ShiftDTO>> getEventShifts(@PathVariable Long id) {
        return ResponseEntity.ok(shiftService.getShiftsByEvent(id));
    }

    @GetMapping("/{id}/work-areas")
    public ResponseEntity<List<WorkAreaDTO>> getEventWorkAreas(@PathVariable Long id) {
        // Feltételezve, hogy az EventService-ben van már ilyen, vagy lekérhető:
        return ResponseEntity.ok(eventService.getWorkAreasByEventId(id));
    }

    // --- ÚJ: Az önkéntes saját műszakjainak lekérése a Naptárhoz ---
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

    // --- ÚJ: Esemény szintű csapat lekérése ---
    @GetMapping("/{eventId}/team")
    @PreAuthorize("@eventSecurity.canManageEventTeam(authentication.name, #eventId)")
    public ResponseEntity<List<com.example.volunteermanagement.dto.EventTeamMemberDTO>> getEventTeam(@PathVariable Long eventId) {
        return ResponseEntity.ok(eventTeamService.getEventTeam(eventId));
    }

    // --- ÚJ: Esemény szintű csapat tagjának módosítása (Mátrix mentés) ---
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
}