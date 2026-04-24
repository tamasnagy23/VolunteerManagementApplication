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
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component("eventSecurity")
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EventSecurityService {

    private final EventTeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final WorkAreaRepository workAreaRepository;
    private final ShiftRepository shiftRepository;
    private final EventRepository eventRepository;

    // --- ÚJ METÓDUS: Biztonságos olvasási jog Koordinátoroknak is! ---
    public boolean canViewEventData(String userEmail, Long eventId) {
        User user = userRepository.findByEmail(userEmail).orElse(null);
        if (user == null) return false;
        if (user.getRole() != null && user.getRole().name().equals("SYS_ADMIN")) return true;

        Event event = eventRepository.findById(eventId).orElse(null);
        if (event != null && event.getOrganization() != null) {
            Long orgId = event.getOrganization().getId();
            boolean isOrgAdmin = user.getMemberships().stream()
                    .anyMatch(m -> m.getOrganization().getId().equals(orgId)
                            && m.getStatus() == MembershipStatus.APPROVED
                            && (m.getRole() == OrganizationRole.ORGANIZER || m.getRole() == OrganizationRole.OWNER));
            if (isOrgAdmin) return true;
        }

        Optional<EventTeamMember> membership = teamMemberRepository.findByUserIdAndEventId(user.getId(), eventId);
        if (membership.isPresent()) {
            EventRole role = membership.get().getRole();
            // A Főszervező és a Koordinátor is megkapja az olvasási jogot a beosztás/jelentkező adatokhoz
            return role == EventRole.ORGANIZER || role == EventRole.COORDINATOR;
        }
        return false;
    }

    public boolean hasPermission(String userEmail, Long eventId, String requiredPermission) {
        User user = userRepository.findByEmail(userEmail).orElse(null);
        if (user == null) return false;

        if (user.getRole() != null && user.getRole().name().equals("SYS_ADMIN")) return true;

        Event event = eventRepository.findById(eventId).orElse(null);
        if (event != null && event.getOrganization() != null) {
            Long orgId = event.getOrganization().getId();
            boolean isOrgAdmin = user.getMemberships().stream()
                    .anyMatch(m -> m.getOrganization().getId().equals(orgId)
                            && m.getStatus() == MembershipStatus.APPROVED
                            && (m.getRole() == OrganizationRole.ORGANIZER || m.getRole() == OrganizationRole.OWNER));
            if (isOrgAdmin) return true;
        }

        Optional<EventTeamMember> membership = teamMemberRepository.findByUserIdAndEventId(user.getId(), eventId);
        if (membership.isPresent()) {
            EventTeamMember teamMember = membership.get();
            if (teamMember.getRole() == EventRole.ORGANIZER) return true;

            // JAVÍTÁS: A Koordinátornak alapértelmezetten látnia kell az Elfogadott jelentkezőket a beosztáshoz!
            if (teamMember.getRole() == EventRole.COORDINATOR && requiredPermission.equals("MANAGE_APPLICATIONS")) {
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

        return workArea.getCoordinatorIds().contains(user.getId());
    }

    public boolean canManageShift(String userEmail, Long shiftId) {
        User user = userRepository.findByEmail(userEmail).orElse(null);
        if (user == null) return false;

        Shift shift = shiftRepository.findById(shiftId).orElse(null);
        if (shift == null) return false;

        if (shift.getType() == ShiftType.PERSONAL) {
            return shift.getAssignments().stream()
                    .anyMatch(a -> a.getUserId().equals(user.getId()));
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

        Event event = eventRepository.findById(eventId).orElse(null);
        if (event != null && event.getOrganization() != null) {
            Long orgId = event.getOrganization().getId();
            boolean isOrgAdmin = user.getMemberships().stream()
                    .anyMatch(m -> m.getOrganization().getId().equals(orgId)
                            && m.getStatus() == MembershipStatus.APPROVED
                            && (m.getRole() == OrganizationRole.ORGANIZER || m.getRole() == OrganizationRole.OWNER));

            if (isOrgAdmin) eventRole = "ORGANIZER";
        }

        Optional<EventTeamMember> membership = teamMemberRepository.findByUserIdAndEventId(user.getId(), eventId);
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
            if (wa.getCoordinatorIds().contains(user.getId())) {
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

    public boolean canManageEventTeam(String userEmail, Long eventId) {
        User user = userRepository.findByEmail(userEmail).orElse(null);
        if (user == null) return false;

        if (user.getRole() != null && user.getRole().name().equals("SYS_ADMIN")) return true;

        Event event = eventRepository.findById(eventId).orElse(null);
        if (event != null && event.getOrganization() != null) {
            Long orgId = event.getOrganization().getId();
            boolean isOrgAdmin = user.getMemberships().stream()
                    .anyMatch(m -> m.getOrganization().getId().equals(orgId)
                            && m.getStatus() == MembershipStatus.APPROVED
                            && (m.getRole() == OrganizationRole.ORGANIZER || m.getRole() == OrganizationRole.OWNER));
            if (isOrgAdmin) return true;
        }

        Optional<EventTeamMember> membership = teamMemberRepository.findByUserIdAndEventId(user.getId(), eventId);
        return membership.isPresent() && membership.get().getRole() == EventRole.ORGANIZER;
    }
}