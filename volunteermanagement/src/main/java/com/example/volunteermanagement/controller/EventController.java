package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.EventDTO;
import com.example.volunteermanagement.model.Event;
import com.example.volunteermanagement.service.EventService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    // Esemény létrehozása (automatikusan validálva)
    @PostMapping
    public ResponseEntity<Event> createEvent(@Valid @RequestBody EventDTO eventDTO) {
        return ResponseEntity.ok(eventService.createEventWithShifts(eventDTO));
    }

    // Események listázása lapozva (pl: ?page=0&size=10)
    @GetMapping
    public ResponseEntity<Page<Event>> getAllEvents(
            @PageableDefault(page = 0, size = 10, sort = "id") Pageable pageable
    ) {
        return ResponseEntity.ok(eventService.getAllEvents(pageable));
    }
}