package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.CreateShiftRequest;
import com.example.volunteermanagement.model.Event;
import com.example.volunteermanagement.model.Shift;
import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.repository.EventRepository;
import com.example.volunteermanagement.repository.ShiftRepository;
import com.example.volunteermanagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/shifts")
@RequiredArgsConstructor
public class ShiftController {

    private final ShiftRepository shiftRepository;
    private final EventRepository eventRepository;
    private final UserRepository userRepository;

    // 1. Üres műszak létrehozása (idősáv definiálása)
    @PostMapping("/create")
    @PreAuthorize("hasAnyAuthority('COORDINATOR', 'ORGANIZER', 'SYS_ADMIN')")
    public ResponseEntity<?> createShiftSlot(@RequestBody CreateShiftRequest request) {
        Event event = eventRepository.findById(request.eventId())
                .orElseThrow(() -> new RuntimeException("Esemény nem található"));

        Shift shift = Shift.builder()
                .event(event)
                .name(request.name()) // <--- ÚJ SOR: Név mentése
                .startTime(request.startTime())
                .endTime(request.endTime())
                .build();

        shiftRepository.save(shift);
        return ResponseEntity.ok("Műszak idősáv létrehozva!");
    }

    // 2. Ember hozzáadása meglévő műszakhoz
    @PostMapping("/{shiftId}/assign/{userId}")
    @PreAuthorize("hasAnyAuthority('COORDINATOR', 'ORGANIZER', 'SYS_ADMIN')")
    public ResponseEntity<?> assignUserToShift(@PathVariable Long shiftId, @PathVariable Long userId) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new RuntimeException("Műszak nem található"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User nem található"));

        // Hozzáadjuk a listához
        shift.getVolunteers().add(user);
        shiftRepository.save(shift);

        return ResponseEntity.ok("Felhasználó hozzáadva a műszakhoz!");
    }

    // 3. Műszakok lekérése egy eseményhez (hogy ki tudjuk választani a listából)
    @GetMapping("/event/{eventId}")
    public ResponseEntity<List<Shift>> getShiftsForEvent(@PathVariable Long eventId) {
        // Ehhez kelleni fog egy findByEventId a repository-ban!
        return ResponseEntity.ok(shiftRepository.findByEventId(eventId));
    }
}