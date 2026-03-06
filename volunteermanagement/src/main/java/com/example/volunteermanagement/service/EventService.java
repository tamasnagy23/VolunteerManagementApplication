package com.example.volunteermanagement.service;

import com.example.volunteermanagement.dto.EventDTO;
import com.example.volunteermanagement.dto.EventQuestionDTO;
import com.example.volunteermanagement.dto.WorkAreaDTO;
import com.example.volunteermanagement.dto.OrganizationDTO;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.EventRepository;
import com.example.volunteermanagement.repository.OrganizationRepository;
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
    private final AuditLogService auditLogService; // <-- ÚJ: Audit Log behozva
    private final OrganizationRepository organizationRepository;

    @Transactional
    public Event createEventWithWorkAreas(EventDTO dto, String creatorEmail) {
        User creator = userRepository.findByEmail(creatorEmail).orElseThrow();
        boolean isSysAdmin = creator.getRole() == Role.SYS_ADMIN;
        Organization org = null;

        // 1. HA A FRONTEND KÜLDÖTT SZERVEZET ID-T (Jövőbiztos megoldás)
        if (dto.organization() != null && dto.organization().id() != null) {
            org = organizationRepository.findById(dto.organization().id())
                    .orElseThrow(() -> new RuntimeException("A megadott szervezet nem található!"));

            // Jogosultság ellenőrzése (ha NEM rendszergazda, akkor kötelező vezetőnek lennie)
            if (!isSysAdmin) {
                final Long targetOrgId = org.getId();
                boolean isLeader = creator.getMemberships().stream()
                        .anyMatch(m -> m.getOrganization().getId().equals(targetOrgId) &&
                                m.getStatus() == MembershipStatus.APPROVED &&
                                (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER));

                if (!isLeader) {
                    throw new RuntimeException("Nincs jogosultságod ebben a szervezetben eseményt létrehozni!");
                }
            }
        }
        // 2. AUTOMATIKUS KIVÁLASZTÁS (Ha nincs beküldve org ID, vegyük a sajátját)
        else {
            org = creator.getMemberships().stream()
                    .filter(m -> m.getStatus() == MembershipStatus.APPROVED &&
                            (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER))
                    .map(OrganizationMember::getOrganization).findFirst()
                    .orElse(null);
        }

        // KIVÉTELEK KEZELÉSE
        if (org == null) {
            if (isSysAdmin) {
                throw new RuntimeException("Rendszergazdaként is kötelező csatlakoznod egy szervezethez (hogy az eseményt ahhoz tudjuk kötni), vagy a felületen ki kell választanod egyet!");
            } else {
                throw new RuntimeException("Hiba: Nincs jóváhagyott vezetői jogosultságod egyetlen szervezetben sem!");
            }
        }

        // --- AZ ESEMÉNY LÉTREHOZÁSA (A kiválasztott szervezet alá) ---
        Event event = Event.builder()
                .title(dto.title())
                .description(dto.description())
                .location(dto.location())
                .startTime(dto.startTime())
                .endTime(dto.endTime())
                .organization(org) // <-- Ide kötjük be az azonosított szervezetet!
                .build();

        if (dto.workAreas() != null) {
            for (WorkAreaDTO waDto : dto.workAreas()) {
                event.getWorkAreas().add(WorkArea.builder()
                        .name(waDto.name()).description(waDto.description()).capacity(waDto.capacity()).event(event).build());
            }
        }

        if (dto.questions() != null) {
            for (EventQuestionDTO qDto : dto.questions()) {
                event.getQuestions().add(EventQuestion.builder()
                        .questionText(qDto.questionText()).questionType(qDto.questionType())
                        .options(qDto.options()).isRequired(qDto.isRequired()).event(event).build());
            }
        }

        Event savedEvent = eventRepository.save(event);

        auditLogService.logAction(
                creatorEmail,
                "EVENT_CREATED",
                "Esemény: " + savedEvent.getTitle(),
                "Új esemény létrehozva " + savedEvent.getWorkAreas().size() + " munkaterülettel.",
                org.getId()
        );

        return savedEvent;
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

    // --- JAVÍTVA: requesterEmail hozzáadva ---
    @Transactional
    public Event updateEvent(Long id, EventDTO dto, String requesterEmail) {
        Event event = eventRepository.findById(id).orElseThrow();
        Long orgId = event.getOrganization().getId(); // Lementjük a naplóhoz

        event.setTitle(dto.title());
        event.setDescription(dto.description());
        event.setLocation(dto.location());
        event.setStartTime(dto.startTime());
        event.setEndTime(dto.endTime());

        event.getWorkAreas().clear();
        if (dto.workAreas() != null) {
            for (WorkAreaDTO waDto : dto.workAreas()) {
                event.getWorkAreas().add(WorkArea.builder()
                        .name(waDto.name()).description(waDto.description()).capacity(waDto.capacity()).event(event).build());
            }
        }

        event.getQuestions().clear();
        if (dto.questions() != null) {
            for (EventQuestionDTO qDto : dto.questions()) {
                event.getQuestions().add(EventQuestion.builder()
                        .questionText(qDto.questionText()).questionType(qDto.questionType())
                        .options(qDto.options()).isRequired(qDto.isRequired()).event(event).build());
            }
        }

        Event updatedEvent = eventRepository.save(event);

        // --- ÚJ: MÓDOSÍTÁS NAPLÓZÁSA ---
        auditLogService.logAction(
                requesterEmail,
                "EVENT_UPDATED",
                "Esemény: " + updatedEvent.getTitle(),
                "Az esemény adatai, területei vagy kérdései módosultak.",
                orgId
        );

        return updatedEvent;
    }

    // --- JAVÍTVA: requesterEmail hozzáadva ---
    @Transactional
    public void deleteEvent(Long id, String requesterEmail) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Esemény nem található"));

        // Mielőtt töröljük, elmentjük a szükséges infókat a naplóhoz!
        Long orgId = event.getOrganization().getId();
        String eventTitle = event.getTitle();

        eventRepository.deleteById(id);

        // --- ÚJ: TÖRLÉS NAPLÓZÁSA ---
        auditLogService.logAction(
                requesterEmail,
                "EVENT_DELETED",
                "Esemény: " + eventTitle,
                "Az esemény véglegesen törölve lett a rendszerből.",
                orgId
        );
    }

    private EventDTO convertToDTO(Event event) {
        return new EventDTO(
                event.getId(), event.getTitle(), event.getDescription(), event.getLocation(),
                event.getStartTime(), event.getEndTime(),
                event.getWorkAreas().stream().map(wa -> new WorkAreaDTO(wa.getId(), wa.getName(), wa.getDescription(), wa.getCapacity(), List.of())).toList(),
                event.getQuestions().stream().map(q -> new EventQuestionDTO(q.getId(), q.getQuestionText(), q.getQuestionType(), q.getOptions(), q.isRequired())).toList(),
                new OrganizationDTO(event.getOrganization().getId(), event.getOrganization().getName(), event.getOrganization().getAddress(), event.getOrganization().getDescription(), event.getOrganization().getEmail(), event.getOrganization().getPhone())
        );
    }

    @Transactional(readOnly = true)
    public List<WorkAreaDTO> getWorkAreasByEventId(Long eventId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Esemény nem található"));

        return event.getWorkAreas().stream()
                .map(area -> new WorkAreaDTO(
                        area.getId(),
                        area.getName(),
                        area.getDescription(),
                        area.getCapacity(),
                        // Itt üres listát küldünk a műszakoknak,
                        // mert azokat a ShiftService külön végponton kezeli
                        List.of()
                ))
                .collect(Collectors.toList());
    }
}