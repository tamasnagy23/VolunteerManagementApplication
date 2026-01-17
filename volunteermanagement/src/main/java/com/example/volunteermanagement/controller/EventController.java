package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.EventDTO;
import com.example.volunteermanagement.dto.ShiftDTO;
import com.example.volunteermanagement.model.Event;
import com.example.volunteermanagement.service.EventService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal; // <--- FONTOS: Ez az import kell!
import java.util.List;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    @PostMapping
    // Itt adjuk hozzá a 'Principal principal' paramétert, ami a bejelentkezett felhasználót tárolja
    public ResponseEntity<Event> createEvent(@RequestBody EventDTO eventDTO, Principal principal) {
        // ITT VOLT A HIBA: Eddig csak (eventDTO)-t küldtünk, most már (eventDTO, email)-t kell
        Event createdEvent = eventService.createEventWithShifts(eventDTO, principal.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(createdEvent);
    }

    @GetMapping
    // Itt is hozzáadjuk a 'Principal' paramétert
    public ResponseEntity<Page<Event>> getAllEvents(Pageable pageable, Principal principal) {
        // Átadjuk a nevet a service-nek, hogy tudjon szűrni
        return ResponseEntity.ok(eventService.getAllEvents(pageable, principal.getName()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Event> getEventById(@PathVariable Long id) {
        return ResponseEntity.ok(eventService.getEventById(id));
    }


    @GetMapping("/my-shifts")
    public ResponseEntity<List<ShiftDTO>> getUserShifts(Principal principal) {
        return ResponseEntity.ok(eventService.getUserShifts(principal.getName()));
    }
}