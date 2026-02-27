package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.EventDTO;
import com.example.volunteermanagement.model.Event;
import com.example.volunteermanagement.service.EventService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    @PostMapping
    public ResponseEntity<EventDTO> createEvent(@RequestBody EventDTO eventDTO, Principal principal) {
        // A service most már a mentett entitást adja vissza, de mi rögtön DTO-vá alakítjuk
        Event createdEvent = eventService.createEventWithWorkAreas(eventDTO, principal.getName());

        // Alakítsuk át DTO-vá a válasz előtt (használd a Service-ben már megírt convertToDTO-t vagy kézzel):
        return ResponseEntity.status(HttpStatus.CREATED).body(eventService.getEventDTOById(createdEvent.getId()));
    }

    @GetMapping
    public ResponseEntity<Page<EventDTO>> getAllEvents(Pageable pageable, Principal principal) {
        return ResponseEntity.ok(eventService.getAllEvents(pageable, principal.getName()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<EventDTO> getEventById(@PathVariable Long id) {
        // Átállítva, hogy DTO-t adjon vissza a terület listával együtt
        return ResponseEntity.ok(eventService.getEventDTOById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Event> updateEvent(@PathVariable Long id, @RequestBody EventDTO eventDTO) {
        return ResponseEntity.ok(eventService.updateEvent(id, eventDTO));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEvent(@PathVariable Long id) {
        eventService.deleteEvent(id);
        return ResponseEntity.noContent().build();
    }
}