package com.example.volunteermanagement.service;

import com.example.volunteermanagement.dto.EventDTO;
import com.example.volunteermanagement.dto.ShiftDTO;
import com.example.volunteermanagement.model.Event;
import com.example.volunteermanagement.model.Organization;
import com.example.volunteermanagement.model.OrganizationRole;
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

        // JAVÍTÁS: A SYS_ADMIN bárhol hozhat létre eseményt?
        // Egyelőre maradjunk annál, hogy kell egy szervezet, ahol vezető.
        Organization org = creator.getMemberships().stream()
                .filter(m -> m.getStatus() == com.example.volunteermanagement.model.MembershipStatus.APPROVED &&
                        (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER))
                .map(m -> m.getOrganization())
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Hiba: Nincs jóváhagyott vezetői jogosultságod!"));

        Event event = Event.builder()
                .title(dto.title())
                .description(dto.description())
                .location(dto.location())
                .startTime(dto.startTime())
                .endTime(dto.endTime())
                .shifts(new ArrayList<>())
                .organization(org)
                .build();

        if (dto.shifts() != null && !dto.shifts().isEmpty()) {
            for (ShiftDTO shiftDto : dto.shifts()) {
                Shift shift = Shift.builder()
                        .name(shiftDto.area())
                        .startTime(shiftDto.startTime())
                        .endTime(shiftDto.endTime())
                        .maxVolunteers(shiftDto.maxVolunteers()) // Ne felejtsd el a létszámot!
                        .event(event)
                        .build();
                event.addShift(shift);
            }
        }

        return eventRepository.save(event);
    }

    public org.springframework.data.domain.Page<com.example.volunteermanagement.dto.EventDTO> getAllEvents(
            org.springframework.data.domain.Pageable pageable,
            String requesterEmail) {

        User user = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));

        // 1. Definiáljuk az ENTITÁS oldalt (ezt kérjük le az adatbázisból)
        org.springframework.data.domain.Page<com.example.volunteermanagement.model.Event> eventEntities;

        if (user.getRole() == com.example.volunteermanagement.model.Role.SYS_ADMIN) {
            eventEntities = eventRepository.findAll(pageable);
        } else {
            List<Long> approvedOrgIds = user.getMemberships().stream()
                    .filter(m -> m.getStatus() == com.example.volunteermanagement.model.MembershipStatus.APPROVED)
                    .map(m -> m.getOrganization().getId())
                    .collect(Collectors.toList());

            if (approvedOrgIds.isEmpty()) {
                return org.springframework.data.domain.Page.empty(pageable);
            }
            eventEntities = eventRepository.findByOrganizationIdIn(approvedOrgIds, pageable);
        }

        // 2. Itt történik a MAPPELÉS: Event -> EventDTO
        // A .map() függvény gondoskodik róla, hogy a Page<Event>-ből Page<EventDTO> legyen
        return eventEntities.map(event -> new com.example.volunteermanagement.dto.EventDTO(
                event.getId(),
                event.getTitle(),
                event.getDescription(),
                event.getLocation(),
                event.getStartTime(),
                event.getEndTime(),
                event.getShifts().stream()
                        .map(s -> new com.example.volunteermanagement.dto.ShiftDTO(
                                s.getId(), s.getName(), s.getStartTime(), s.getEndTime(), s.getMaxVolunteers()))
                        .collect(Collectors.toList()),
                new com.example.volunteermanagement.dto.OrganizationDTO(
                        event.getOrganization().getId(),
                        event.getOrganization().getName(),
                        event.getOrganization().getAddress(),
                        event.getOrganization().getDescription(), // ÚJ
                        event.getOrganization().getEmail(),       // ÚJ
                        event.getOrganization().getPhone()
                )
        ));
    }

    public Event getEventById(Long id) {
        return eventRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Az esemény nem található: " + id));
    }

    public List<ShiftDTO> getUserShifts(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User nem található"));

        // Megkeressük azokat a műszakokat, amikre az adott felhasználó már jelentkezett (és el lett fogadva)
        List<Shift> databaseShifts = shiftRepository.findByVolunteersContaining(user);

        return databaseShifts.stream()
                .map(shift -> new ShiftDTO(
                        shift.getId(),
                        shift.getName(),
                        shift.getStartTime(),
                        shift.getEndTime(),
                        shift.getMaxVolunteers()
                ))
                .collect(Collectors.toList());
    }

    @Transactional
    public Event updateEvent(Long id, EventDTO dto) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Esemény nem található"));

        event.setTitle(dto.title());
        event.setDescription(dto.description());
        event.setLocation(dto.location());
        event.setStartTime(dto.startTime());
        event.setEndTime(dto.endTime());

        // Műszakok frissítése: egyszerűség kedvéért töröljük a régieket és újakat adunk hozzá
        // (Vigyázat: élesben ez törli a meglévő jelentkezéseket is a műszakokról!)
        event.getShifts().clear();

        if (dto.shifts() != null) {
            for (var shiftDto : dto.shifts()) {
                Shift newShift = Shift.builder()
                        .name(shiftDto.area())
                        .startTime(shiftDto.startTime())
                        .endTime(shiftDto.endTime())
                        .maxVolunteers(shiftDto.maxVolunteers())
                        .event(event)
                        .build();
                event.addShift(newShift);
            }
        }

        return eventRepository.save(event);
    }

    @Transactional
    public void deleteEvent(Long id) {
        if (!eventRepository.existsById(id)) {
            throw new RuntimeException("Esemény nem található.");
        }
        eventRepository.deleteById(id);
    }
}