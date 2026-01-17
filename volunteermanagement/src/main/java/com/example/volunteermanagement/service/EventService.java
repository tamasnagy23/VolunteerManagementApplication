package com.example.volunteermanagement.service;

import com.example.volunteermanagement.dto.EventDTO;
import com.example.volunteermanagement.dto.ShiftDTO;
import com.example.volunteermanagement.model.Event;
import com.example.volunteermanagement.model.Shift;
import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.repository.EventRepository;
import com.example.volunteermanagement.repository.ShiftRepository;
import com.example.volunteermanagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;
    private final ShiftRepository shiftRepository;
    private final UserRepository userRepository;

    @Transactional
    public Event createEventWithShifts(EventDTO dto, String creatorEmail) {

        User creator = userRepository.findByEmail(creatorEmail)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));

        if (creator.getOrganization() == null) {
            throw new RuntimeException("Hiba: Ez a felhasználó nem tartozik egyetlen szervezethez sem!");
        }

        Event event = Event.builder()
                .title(dto.title())
                .description(dto.description())
                .location(dto.location())
                .startTime(dto.startTime())
                .endTime(dto.endTime())
                .shifts(new ArrayList<>())
                .organization(creator.getOrganization())
                .build();

        // Mivel átalakult a rendszer, az esemény létrehozásakor
        // egyelőre nem hozunk létre műszakokat (azokat a koordinátor osztja be később),
        // vagy ha mégis, akkor csak időpontokat tárolunk, létszámkorlát nélkül.
        if (dto.shifts() != null && !dto.shifts().isEmpty()) {
            for (ShiftDTO shiftDto : dto.shifts()) {
                Shift shift = Shift.builder()
                        .startTime(shiftDto.startTime())
                        .endTime(shiftDto.endTime())
                        .event(event) // Beállítjuk a kapcsolatot
                        .build();
                event.addShift(shift);
            }
        }

        return eventRepository.save(event);
    }

    public Page<Event> getAllEvents(Pageable pageable, String requesterEmail) {
        User user = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));

        if (user.getRole() == com.example.volunteermanagement.model.Role.SYS_ADMIN) {
            return eventRepository.findAll(pageable);
        }

        if (user.getOrganization() == null) {
            // Ha önkéntes és nincs szervezete, akkor is látnia kell az eseményeket,
            // hogy tudjon jelentkezni! (Kivéve, ha privát események).
            // Egyelőre feltételezzük, hogy az önkéntesek mindent láthatnak, vagy módosítsd igény szerint.
            // Ha azt akarod, hogy az önkéntesek MINDEN publikus eseményt lássanak:
            if (user.getRole() == com.example.volunteermanagement.model.Role.VOLUNTEER) {
                return eventRepository.findAll(pageable);
            }
            return Page.empty();
        }

        return eventRepository.findAllByOrganizationId(user.getOrganization().getId(), pageable);
    }

    public Event getEventById(Long id) {
        return eventRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Az esemény nem található ezzel az ID-val: " + id));
    }

    // --- AZ applyToShift METÓDUS TÖRÖLVE LETT! ---
    // (Mert most már az ApplicationController kezeli a jelentkezést WorkArea-ra)

    // --- SAJÁT MŰSZAKOK LEKÉRÉSE (JAVÍTOTT) ---
    public List<ShiftDTO> getUserShifts(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User nem található"));

        // JAVÍTÁS: findByAssignedUser -> findByVolunteersContaining
        List<Shift> databaseShifts = shiftRepository.findByVolunteersContaining(user);

        return databaseShifts.stream()
                .map(shift -> new ShiftDTO(
                        shift.getId(),
                        shift.getStartTime(),
                        shift.getEndTime()
                ))
                .collect(Collectors.toList());
    }
}