package com.example.volunteermanagement.service;

import com.example.volunteermanagement.dto.EventDTO;
import com.example.volunteermanagement.dto.ShiftDTO;
import com.example.volunteermanagement.model.Event;
import com.example.volunteermanagement.model.Shift;
import com.example.volunteermanagement.repository.EventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;

@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;

    @Transactional
    public Event createEventWithShifts(EventDTO dto) {
        // ITT VOLT A HIÁNY: Hozzáadtuk a .startTime() és .endTime() sorokat
        Event event = Event.builder()
                .title(dto.title())
                .description(dto.description())
                .location(dto.location())
                .startTime(dto.startTime()) // <--- ÚJ SOR
                .endTime(dto.endTime())     // <--- ÚJ SOR
                .shifts(new ArrayList<>())
                .build();

        // Ez a rész kezeli a műszakokat, ha vannak (ez jó így, maradhat)
        if (dto.shifts() != null) {
            for (ShiftDTO shiftDto : dto.shifts()) {
                Shift shift = Shift.builder()
                        .startTime(shiftDto.startTime())
                        .endTime(shiftDto.endTime())
                        .maxVolunteers(shiftDto.maxVolunteers())
                        .build();
                event.addShift(shift);
            }
        }
        return eventRepository.save(event);
    }

    public Page<Event> getAllEvents(Pageable pageable) {
        return eventRepository.findAll(pageable);
    }
}