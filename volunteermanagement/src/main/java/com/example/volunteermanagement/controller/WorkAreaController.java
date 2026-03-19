package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.CreateWorkAreaRequest;
import com.example.volunteermanagement.dto.WorkAreaDTO;
import com.example.volunteermanagement.model.Event;
import com.example.volunteermanagement.model.WorkArea;
import com.example.volunteermanagement.repository.EventRepository;
import com.example.volunteermanagement.repository.WorkAreaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/work-areas")
@RequiredArgsConstructor
public class WorkAreaController {

    private final WorkAreaRepository workAreaRepository;
    private final EventRepository eventRepository;

    // JAVÍTVA: Csak akkor vehet fel új területet az eseménybe, ha van rá esemény-jogosultsága!
    @PostMapping("/event/{eventId}")
    @PreAuthorize("@eventSecurity.hasPermission(authentication.name, #eventId, 'MANAGE_SHIFTS')")
    public ResponseEntity<?> createWorkArea(@PathVariable Long eventId, @RequestBody CreateWorkAreaRequest request) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Esemény nem található"));

        WorkArea workArea = WorkArea.builder()
                .name(request.name())
                .description(request.description())
                .capacity(request.capacity())
                .event(event)
                .build();

        workAreaRepository.save(workArea);
        return ResponseEntity.ok("Munkaterület létrehozva!");
    }

    @GetMapping("/event/{eventId}")
    public ResponseEntity<List<WorkAreaDTO>> getWorkAreasForEvent(@PathVariable Long eventId) {
        List<WorkArea> areas = workAreaRepository.findByEventId(eventId);
        List<WorkAreaDTO> dtos = areas.stream()
                .map(area -> new WorkAreaDTO(area.getId(), area.getName(), area.getDescription(), area.getCapacity(), List.of()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    // JAVÍTVA: Törlésnél kikeresi, hogy a munkaterület melyik Eventhez tartozik, és azt ellenőrzi
    @DeleteMapping("/{id}")
    @PreAuthorize("@eventSecurity.canManageWorkArea(authentication.name, #id)")
    public ResponseEntity<?> deleteWorkArea(@PathVariable Long id) {
        workAreaRepository.deleteById(id);
        return ResponseEntity.ok("Terület törölve!");
    }
}