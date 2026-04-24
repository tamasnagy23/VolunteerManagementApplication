package com.example.volunteermanagement.service;

import com.example.volunteermanagement.config.DataSourceConfig;
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
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EventTeamService {

    private final EventRepository eventRepository;
    private final UserRepository userRepository;
    private final EventTeamMemberRepository teamMemberRepository;
    private final WorkAreaRepository workAreaRepository;
    private final AuditLogService auditLogService;
    private final ApplicationRepository applicationRepository;
    private final DataSourceConfig dataSourceConfig;

    private final OrganizationMemberRepository organizationMemberRepository;

    @Transactional(readOnly = true)
    public List<EventTeamMemberDTO> getEventTeam(Long eventId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Esemény nem található"));

        List<EventTeamMember> explicitTeamMembers = teamMemberRepository.findByEventId(eventId);
        Set<Long> teamMemberUserIds = explicitTeamMembers.stream()
                .map(EventTeamMember::getUserId)
                .collect(Collectors.toSet());

        List<Application> approvedApplications = applicationRepository.findByEventId(eventId).stream()
                .filter(app -> app.getStatus() == ApplicationStatus.APPROVED)
                .collect(Collectors.toList());

        Set<Long> approvedVolunteerIds = approvedApplications.stream()
                .map(Application::getUserId)
                .collect(Collectors.toSet());

        List<User> sysAdmins = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.SYS_ADMIN)
                .collect(Collectors.toList());

        // JAVÍTÁS: findByOrganizationId használata!
        List<OrganizationMember> orgLeaders = organizationMemberRepository.findByOrganizationId(event.getOrganization().getId()).stream()
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED &&
                        (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER))
                .collect(Collectors.toList());

        Set<Long> actualParticipantIds = new java.util.HashSet<>();
        actualParticipantIds.addAll(teamMemberUserIds);
        actualParticipantIds.addAll(approvedVolunteerIds);
        sysAdmins.forEach(admin -> actualParticipantIds.add(admin.getId()));
        orgLeaders.forEach(leader -> actualParticipantIds.add(leader.getUser().getId()));

        if (actualParticipantIds.isEmpty()) {
            return new ArrayList<>();
        }

        List<User> actualParticipants = userRepository.findAllById(actualParticipantIds);
        List<WorkArea> workAreas = workAreaRepository.findByEventId(eventId);

        java.util.Map<Long, java.util.Map<String, String>> masterDataMap = new java.util.HashMap<>();
        List<Long> userIds = new ArrayList<>(actualParticipantIds);
        String placeholders = String.join(",", java.util.Collections.nCopies(userIds.size(), "?"));
        String sql = "SELECT id, phone_number, profile_image_url FROM users WHERE id IN (" + placeholders + ")";

        try (java.sql.Connection conn = dataSourceConfig.getMasterDataSource().getConnection();
             java.sql.PreparedStatement ps = conn.prepareStatement(sql)) {
            int index = 1;
            for (Long id : userIds) { ps.setLong(index++, id); }
            try (java.sql.ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    java.util.Map<String, String> data = new java.util.HashMap<>();
                    data.put("phone", rs.getString("phone_number"));
                    data.put("image", rs.getString("profile_image_url"));
                    masterDataMap.put(rs.getLong("id"), data);
                }
            }
        } catch (Exception e) {
            System.err.println("Hiba a Mester adatbázis olvasásakor az EventTeamService-ben: " + e.getMessage());
        }

        java.util.Map<Long, String> userOrgRoles = new java.util.HashMap<>();
        // JAVÍTÁS: findByOrganizationId használata!
        organizationMemberRepository.findByOrganizationId(event.getOrganization().getId())
                .forEach(m -> userOrgRoles.put(m.getUser().getId(), m.getRole().name()));

        return actualParticipants.stream().map(user -> {
            Optional<EventTeamMember> teamMemberOpt = explicitTeamMembers.stream()
                    .filter(m -> m.getUserId().equals(user.getId()))
                    .findFirst();

            boolean isSysAdmin = user.getRole() == Role.SYS_ADMIN;
            String orgRole = userOrgRoles.get(user.getId());

            String role = teamMemberOpt.map(m -> m.getRole().name()).orElse(null);
            if (role == null && (isSysAdmin || "OWNER".equals(orgRole) || "ORGANIZER".equals(orgRole))) {
                role = "ORGANIZER";
            }

            List<String> perms = teamMemberOpt.map(m -> m.getPermissions().stream().map(Enum::name).collect(Collectors.toList()))
                    .orElse(new ArrayList<>());

            List<Long> coordinatedAreaIds = workAreas.stream()
                    .filter(wa -> wa.getCoordinatorIds().contains(user.getId()))
                    .map(WorkArea::getId)
                    .collect(Collectors.toList());

            java.util.Map<String, String> masterData = masterDataMap.getOrDefault(user.getId(), new java.util.HashMap<>());
            String realPhone = masterData.get("phone") != null ? masterData.get("phone") : user.getPhoneNumber();
            String realImage = masterData.get("image") != null ? masterData.get("image") : user.getProfileImageUrl();

            return new EventTeamMemberDTO(
                    user.getId(),
                    user.getName(),
                    user.getEmail(),
                    realPhone,
                    realImage,
                    role,
                    perms,
                    coordinatedAreaIds,
                    isSysAdmin,
                    orgRole
            );
        }).collect(Collectors.toList());
    }

    @Transactional
    public void updateEventTeamMember(Long eventId, Long userId, UpdateEventTeamMemberRequest request, String adminEmail) {
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("Felhasználó nem található"));
        Event event = eventRepository.findById(eventId).orElseThrow(() -> new RuntimeException("Esemény nem található"));

        Optional<EventTeamMember> teamMemberOpt = teamMemberRepository.findByUserIdAndEventId(user.getId(), eventId);

        if (request.eventRole() == null) {
            teamMemberOpt.ifPresent(teamMemberRepository::delete);
        } else {
            EventTeamMember etm = teamMemberOpt.orElseGet(() -> EventTeamMember.builder().userId(user.getId()).event(event).build());
            etm.setRole(EventRole.valueOf(request.eventRole()));
            etm.setPermissions(request.permissions().stream().map(EventPermission::valueOf).collect(Collectors.toSet()));
            teamMemberRepository.save(etm);
        }

        List<WorkArea> workAreas = workAreaRepository.findByEventId(eventId);
        List<Long> requestedIds = request.coordinatedWorkAreaIds().stream()
                .map(Number::longValue)
                .collect(Collectors.toList());

        for (WorkArea wa : workAreas) {
            boolean isCurrentlyCoordinator = wa.getCoordinatorIds().contains(user.getId());
            boolean shouldBeCoordinator = requestedIds.contains(wa.getId());

            if (shouldBeCoordinator && !isCurrentlyCoordinator) {
                wa.getCoordinatorIds().add(user.getId());
            } else if (!shouldBeCoordinator && isCurrentlyCoordinator) {
                wa.getCoordinatorIds().remove(user.getId());
            }
        }
        workAreaRepository.saveAll(workAreas);

        auditLogService.logAction(adminEmail, "UPDATE_EVENT_TEAM",
                "Esemény: " + event.getTitle(),
                "Felhasználó (" + user.getEmail() + ") jogosultságai frissítve.",
                event.getOrganization().getId());
    }
}