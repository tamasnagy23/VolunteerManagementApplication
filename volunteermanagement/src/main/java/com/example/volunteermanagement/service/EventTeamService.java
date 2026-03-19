package com.example.volunteermanagement.service;

import com.example.volunteermanagement.dto.EventTeamMemberDTO;
import com.example.volunteermanagement.dto.UpdateEventTeamMemberRequest;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EventTeamService {

    private final EventRepository eventRepository;
    private final UserRepository userRepository;
    private final EventTeamMemberRepository teamMemberRepository;
    private final WorkAreaRepository workAreaRepository;
    private final AuditLogService auditLogService;
    private final OrganizationMemberRepository organizationMemberRepository;

    @Transactional(readOnly = true)
    public List<EventTeamMemberDTO> getEventTeam(Long eventId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Esemény nem található"));

        List<OrganizationMember> allMembers = organizationMemberRepository.findByOrganizationId(event.getOrganization().getId());

        List<User> orgMembers = allMembers.stream()
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .map(OrganizationMember::getUser)
                .collect(Collectors.toList());

        // Biztosabb lekérdezés a területekre közvetlenül a Repository-ból
        List<WorkArea> workAreas = workAreaRepository.findByEventId(eventId);

        return orgMembers.stream().map(user -> {
            Optional<EventTeamMember> teamMemberOpt = teamMemberRepository.findByUserAndEventId(user, eventId);

            String role = teamMemberOpt.map(m -> m.getRole().name()).orElse(null);
            List<String> perms = teamMemberOpt.map(m -> m.getPermissions().stream().map(Enum::name).collect(Collectors.toList()))
                    .orElse(new ArrayList<>());

            // JAVÍTÁS 1: Proxy probléma kiküszöbölése - Kifejezetten az ID-t vizsgáljuk az objektum helyett!
            List<Long> coordinatedAreaIds = workAreas.stream()
                    .filter(wa -> wa.getCoordinators().stream().anyMatch(c -> c.getId().equals(user.getId())))
                    .map(WorkArea::getId)
                    .collect(Collectors.toList());

            return new EventTeamMemberDTO(user.getId(), user.getName(), user.getEmail(), role, perms, coordinatedAreaIds);
        }).collect(Collectors.toList());
    }

    @Transactional
    public void updateEventTeamMember(Long eventId, Long userId, UpdateEventTeamMemberRequest request, String adminEmail) {
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("Felhasználó nem található"));
        Event event = eventRepository.findById(eventId).orElseThrow(() -> new RuntimeException("Esemény nem található"));

        // 1. Esemény Szerepkör és Plecsnik frissítése
        Optional<EventTeamMember> teamMemberOpt = teamMemberRepository.findByUserAndEventId(user, eventId);

        if (request.eventRole() == null) {
            teamMemberOpt.ifPresent(teamMemberRepository::delete);
        } else {
            EventTeamMember etm = teamMemberOpt.orElseGet(() -> EventTeamMember.builder().user(user).event(event).build());
            etm.setRole(EventRole.valueOf(request.eventRole()));
            etm.setPermissions(request.permissions().stream().map(EventPermission::valueOf).collect(Collectors.toSet()));
            teamMemberRepository.save(etm);
        }

        // 2. JAVÍTÁS 2: Munkaterületek listájának biztonságos mentése ID alapján
        List<WorkArea> workAreas = workAreaRepository.findByEventId(eventId);
        List<Long> requestedIds = request.coordinatedWorkAreaIds().stream()
                .map(Number::longValue) // JSON Integer -> Long konverziós hiba elkerülése
                .collect(Collectors.toList());

        for (WorkArea wa : workAreas) {
            boolean isCurrentlyCoordinator = wa.getCoordinators().stream()
                    .anyMatch(c -> c.getId().equals(user.getId()));
            boolean shouldBeCoordinator = requestedIds.contains(wa.getId());

            if (shouldBeCoordinator && !isCurrentlyCoordinator) {
                wa.getCoordinators().add(user);
            } else if (!shouldBeCoordinator && isCurrentlyCoordinator) {
                wa.getCoordinators().removeIf(c -> c.getId().equals(user.getId()));
            }
        }
        workAreaRepository.saveAll(workAreas);

        // 3. Naplózás
        auditLogService.logAction(adminEmail, "UPDATE_EVENT_TEAM",
                "Esemény: " + event.getTitle(),
                "Felhasználó (" + user.getEmail() + ") jogosultságai frissítve.",
                event.getOrganization().getId());
    }
}