package com.example.volunteermanagement.service;

import com.example.volunteermanagement.dto.EventPermissionsDTO;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.EventRepository;
import com.example.volunteermanagement.repository.EventTeamMemberRepository;
import com.example.volunteermanagement.repository.ShiftRepository;
import com.example.volunteermanagement.repository.UserRepository;
import com.example.volunteermanagement.repository.WorkAreaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component("eventSecurity")
@RequiredArgsConstructor
public class EventSecurityService {

    private final EventTeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final WorkAreaRepository workAreaRepository;
    private final ShiftRepository shiftRepository;
    private final EventRepository eventRepository; // <-- Ezt adtuk hozzá a gyors kereséshez!

    public boolean hasPermission(String userEmail, Long eventId, String requiredPermission) {
        User user = userRepository.findByEmail(userEmail).orElse(null);
        if (user == null) return false;

        // 1. Rendszergazda mindent megtehet
        if (user.getRole() != null && user.getRole().name().equals("SYS_ADMIN")) {
            return true;
        }

        // 2. ÚJ: Ha a Szervezet Főszervezője/Alapítója, szintén mindent megtehet!
        Event event = eventRepository.findById(eventId).orElse(null);
        if (event != null && event.getOrganization() != null) {
            Long orgId = event.getOrganization().getId();
            boolean isOrgAdmin = user.getMemberships().stream()
                    .anyMatch(m -> m.getOrganization().getId().equals(orgId)
                            && m.getStatus() == MembershipStatus.APPROVED
                            && (m.getRole() == OrganizationRole.ORGANIZER || m.getRole() == OrganizationRole.OWNER));
            if (isOrgAdmin) return true;
        }

        // 3. Eseménycsapat tagság vizsgálata
        Optional<EventTeamMember> membership = teamMemberRepository.findByUserAndEventId(user, eventId);
        if (membership.isPresent()) {
            EventTeamMember teamMember = membership.get();
            if (teamMember.getRole() == EventRole.ORGANIZER) {
                return true;
            }
            try {
                EventPermission perm = EventPermission.valueOf(requiredPermission);
                return teamMember.getPermissions().contains(perm);
            } catch (IllegalArgumentException e) {
                return false;
            }
        }

        return false;
    }

    public boolean canManageWorkArea(String userEmail, Long workAreaId) {
        User user = userRepository.findByEmail(userEmail).orElse(null);
        if (user == null) return false;

        if (user.getRole() != null && user.getRole().name().equals("SYS_ADMIN")) return true;

        WorkArea workArea = workAreaRepository.findById(workAreaId).orElse(null);
        if (workArea == null) return false;

        Long eventId = workArea.getEvent().getId();

        if (hasPermission(userEmail, eventId, "MANAGE_SHIFTS")) return true;

        return workArea.getCoordinators().contains(user);
    }

    public boolean canManageShift(String userEmail, Long shiftId) {
        Shift shift = shiftRepository.findById(shiftId).orElse(null);
        if (shift == null) return false;

        if (shift.getType() == ShiftType.PERSONAL) {
            return shift.getAssignments().stream()
                    .anyMatch(a -> a.getUser().getEmail().equals(userEmail));
        }

        if (shift.getWorkArea() != null) {
            return canManageWorkArea(userEmail, shift.getWorkArea().getId());
        } else if (shift.getEvent() != null) {
            return hasPermission(userEmail, shift.getEvent().getId(), "MANAGE_SHIFTS");
        }
        return false;
    }

    public boolean canCreateEventForOrg(String userEmail, Long orgId) {
        User user = userRepository.findByEmail(userEmail).orElse(null);
        if (user == null) return false;

        if (user.getRole() != null && user.getRole().name().equals("SYS_ADMIN")) return true;

        return user.getMemberships().stream()
                .anyMatch(m -> m.getOrganization().getId().equals(orgId)
                        && m.getStatus() == MembershipStatus.APPROVED
                        && (m.getRole() == OrganizationRole.ORGANIZER || m.getRole() == OrganizationRole.OWNER));
    }

    public EventPermissionsDTO getMyPermissionsForEvent(String userEmail, Long eventId) {
        User user = userRepository.findByEmail(userEmail).orElse(null);
        if (user == null) return null;

        boolean isGlobalAdmin = user.getRole() != null && user.getRole().name().equals("SYS_ADMIN");

        String eventRole = null;
        List<String> permissions = new ArrayList<>();
        List<Long> coordinatedAreaIds = new ArrayList<>();

        // JAVÍTVA: Az EventRepository használatával pillanatok alatt megvan a kapcsolat!
        Event event = eventRepository.findById(eventId).orElse(null);
        if (event != null && event.getOrganization() != null) {
            Long orgId = event.getOrganization().getId();
            boolean isOrgAdmin = user.getMemberships().stream()
                    .anyMatch(m -> m.getOrganization().getId().equals(orgId)
                            && m.getStatus() == MembershipStatus.APPROVED
                            && (m.getRole() == OrganizationRole.ORGANIZER || m.getRole() == OrganizationRole.OWNER));

            if (isOrgAdmin) {
                eventRole = "ORGANIZER";
            }
        }

        Optional<EventTeamMember> membership = teamMemberRepository.findByUserAndEventId(user, eventId);
        if (membership.isPresent()) {
            EventTeamMember member = membership.get();
            if (eventRole == null || member.getRole() == EventRole.ORGANIZER) {
                eventRole = member.getRole().name();
            }
            permissions = member.getPermissions().stream()
                    .map(Enum::name)
                    .collect(Collectors.toList());
        }

        List<WorkArea> allAreasForEvent = workAreaRepository.findAll().stream()
                .filter(wa -> wa.getEvent().getId().equals(eventId))
                .collect(Collectors.toList());

        for (WorkArea wa : allAreasForEvent) {
            if (wa.getCoordinators().contains(user)) {
                coordinatedAreaIds.add(wa.getId());
            }
        }

        return EventPermissionsDTO.builder()
                .isGlobalAdmin(isGlobalAdmin)
                .eventRole(eventRole)
                .permissions(permissions)
                .coordinatedWorkAreas(coordinatedAreaIds)
                .build();
    }

    /**
     * Csak Globális Admin, Szervezet Tulajdonos/Főszervező, vagy az Esemény Főszervezője módosíthatja a csapatot!
     */
    public boolean canManageEventTeam(String userEmail, Long eventId) {
        User user = userRepository.findByEmail(userEmail).orElse(null);
        if (user == null) return false;

        // 1. Rendszergazda mindent megtehet
        if (user.getRole() != null && user.getRole().name().equals("SYS_ADMIN")) return true;

        // 2. Szervezet Alapítója vagy Főszervezője
        Event event = eventRepository.findById(eventId).orElse(null);
        if (event != null && event.getOrganization() != null) {
            Long orgId = event.getOrganization().getId();
            boolean isOrgAdmin = user.getMemberships().stream()
                    .anyMatch(m -> m.getOrganization().getId().equals(orgId)
                            && m.getStatus() == MembershipStatus.APPROVED
                            && (m.getRole() == OrganizationRole.ORGANIZER || m.getRole() == OrganizationRole.OWNER));
            if (isOrgAdmin) return true;
        }

        // 3. Kifejezetten erre az eseményre kinevezett Főszervező (ORGANIZER)
        Optional<EventTeamMember> membership = teamMemberRepository.findByUserAndEventId(user, eventId);
        return membership.isPresent() && membership.get().getRole() == EventRole.ORGANIZER;
    }
}