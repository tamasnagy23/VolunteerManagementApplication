package com.example.volunteermanagement.service;

import com.example.volunteermanagement.dto.EventDTO;
import com.example.volunteermanagement.dto.EventQuestionDTO;
import com.example.volunteermanagement.dto.WorkAreaDTO;
import com.example.volunteermanagement.dto.OrganizationDTO;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.EventRepository;
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
    private final UserRepository userRepository;

    @Transactional
    public Event createEventWithWorkAreas(EventDTO dto, String creatorEmail) {
        User creator = userRepository.findByEmail(creatorEmail).orElseThrow();
        Organization org = creator.getMemberships().stream()
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED &&
                        (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER))
                .map(OrganizationMember::getOrganization).findFirst()
                .orElseThrow(() -> new RuntimeException("Hiba: Nincs jóváhagyott vezetői jogosultságod!"));

        Event event = Event.builder()
                .title(dto.title())
                .description(dto.description())
                .location(dto.location())
                .startTime(dto.startTime())
                .endTime(dto.endTime())
                .organization(org)
                .build();

        // 1. Munkaterületek mentése
        if (dto.workAreas() != null) {
            for (WorkAreaDTO waDto : dto.workAreas()) {
                event.getWorkAreas().add(WorkArea.builder()
                        .name(waDto.name()).description(waDto.description()).capacity(waDto.capacity()).event(event).build());
            }
        }

        // 2. Kérdések mentése (ÚJ RÉSZ)
        if (dto.questions() != null) {
            for (EventQuestionDTO qDto : dto.questions()) {
                event.getQuestions().add(EventQuestion.builder()
                        .questionText(qDto.questionText()).questionType(qDto.questionType())
                        .options(qDto.options()).isRequired(qDto.isRequired()).event(event).build());
            }
        }

        return eventRepository.save(event);
    }

    public Page<EventDTO> getAllEvents(Pageable pageable, String requesterEmail) {
        User user = userRepository.findByEmail(requesterEmail).orElseThrow();
        Page<Event> eventEntities;
        if (user.getRole() == Role.SYS_ADMIN) {
            eventEntities = eventRepository.findAll(pageable);
        } else {
            List<Long> approvedOrgIds = user.getMemberships().stream()
                    .filter(m -> m.getStatus() == MembershipStatus.APPROVED).map(m -> m.getOrganization().getId()).toList();
            if (approvedOrgIds.isEmpty()) return Page.empty(pageable);
            eventEntities = eventRepository.findByOrganizationIdIn(approvedOrgIds, pageable);
        }
        return eventEntities.map(this::convertToDTO);
    }

    public EventDTO getEventDTOById(Long id) {
        return convertToDTO(eventRepository.findById(id).orElseThrow());
    }

    public Event getEventById(Long id) {
        return eventRepository.findById(id).orElseThrow();
    }

    @Transactional
    public Event updateEvent(Long id, EventDTO dto) {
        Event event = eventRepository.findById(id).orElseThrow();

        event.setTitle(dto.title());
        event.setDescription(dto.description());
        event.setLocation(dto.location());
        event.setStartTime(dto.startTime());
        event.setEndTime(dto.endTime());

        // Területek frissítése
        event.getWorkAreas().clear();
        if (dto.workAreas() != null) {
            for (WorkAreaDTO waDto : dto.workAreas()) {
                event.getWorkAreas().add(WorkArea.builder()
                        .name(waDto.name()).description(waDto.description()).capacity(waDto.capacity()).event(event).build());
            }
        }

        // Kérdések frissítése (ÚJ RÉSZ)
        event.getQuestions().clear();
        if (dto.questions() != null) {
            for (EventQuestionDTO qDto : dto.questions()) {
                event.getQuestions().add(EventQuestion.builder()
                        .questionText(qDto.questionText()).questionType(qDto.questionType())
                        .options(qDto.options()).isRequired(qDto.isRequired()).event(event).build());
            }
        }

        return eventRepository.save(event);
    }

    @Transactional
    public void deleteEvent(Long id) {
        eventRepository.deleteById(id);
    }

    private EventDTO convertToDTO(Event event) {
        return new EventDTO(
                event.getId(), event.getTitle(), event.getDescription(), event.getLocation(),
                event.getStartTime(), event.getEndTime(),
                event.getWorkAreas().stream().map(wa -> new WorkAreaDTO(wa.getId(), wa.getName(), wa.getDescription(), wa.getCapacity())).toList(),

                // ÚJ RÉSZ: Kérdések konvertálása DTO-ba
                event.getQuestions().stream().map(q -> new EventQuestionDTO(q.getId(), q.getQuestionText(), q.getQuestionType(), q.getOptions(), q.isRequired())).toList(),

                new OrganizationDTO(event.getOrganization().getId(), event.getOrganization().getName(), event.getOrganization().getAddress(), event.getOrganization().getDescription(), event.getOrganization().getEmail(), event.getOrganization().getPhone())
        );
    }
}