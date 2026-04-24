package com.example.volunteermanagement.service;

import com.example.volunteermanagement.tenant.TenantContext;
import com.example.volunteermanagement.dto.EventDTO;
import com.example.volunteermanagement.dto.EventQuestionDTO;
import com.example.volunteermanagement.dto.WorkAreaDTO;
import com.example.volunteermanagement.dto.OrganizationDTO;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.EventRepository;
import com.example.volunteermanagement.repository.OrganizationRepository;
import com.example.volunteermanagement.repository.ShiftRepository;
import com.example.volunteermanagement.repository.UserRepository;
import com.example.volunteermanagement.repository.EventTeamMemberRepository;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.hibernate.Hibernate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final OrganizationRepository organizationRepository;
    private final ShiftRepository shiftRepository;
    private final EventTeamMemberRepository eventTeamMemberRepository;
    private final TransactionTemplate transactionTemplate;

    @Autowired
    @Lazy
    private EventService self;

    @Transactional
    public EventDTO createEventWithWorkAreas(EventDTO dto, String creatorEmail) {
        User creator = userRepository.findByEmail(creatorEmail).orElseThrow();
        boolean isSysAdmin = creator.getRole() == Role.SYS_ADMIN;
        Organization org = null;

        if (dto.organization() != null && dto.organization().id() != null) {
            org = organizationRepository.findById(dto.organization().id())
                    .orElseThrow(() -> new RuntimeException("A megadott szervezet nem található!"));

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
        } else {
            org = creator.getMemberships().stream()
                    .filter(m -> m.getStatus() == MembershipStatus.APPROVED &&
                            (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER))
                    .map(OrganizationMember::getOrganization).findFirst()
                    .orElse(null);
        }

        if (org == null) {
            throw new RuntimeException("Rendszergazdaként is kötelező csatlakoznod egy szervezethez, vagy a felületen ki kell választanod egyet!");
        }

        Event event = Event.builder()
                .title(dto.title())
                .description(dto.description())
                .location(dto.location())
                .startTime(dto.startTime())
                .endTime(dto.endTime())
                .applicationDeadline(dto.applicationDeadline())
                .isRegistrationOpen(dto.isRegistrationOpen() != null ? dto.isRegistrationOpen() : true)
                .organization(org)
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
        syncEventToMaster(savedEvent, org.getId());

        EventTeamMember teamMember = EventTeamMember.builder()
                .event(savedEvent)
                .userId(creator.getId())
                .role(EventRole.ORGANIZER)
                .build();

        eventTeamMemberRepository.save(teamMember);

        auditLogService.logAction(creatorEmail, "EVENT_CREATED", "Esemény: " + savedEvent.getTitle(), "Új esemény létrehozva.", org.getId());

        // JAVÍTÁS: Itt is DTO-t adunk vissza!
        return convertToDTO(savedEvent);
    }

    @Transactional(readOnly = true)
    public Page<EventDTO> getAllEvents(Pageable pageable, String requesterEmail, Long requestedOrgId) {
        User user = userRepository.findByEmail(requesterEmail).orElseThrow();
        List<Organization> targetOrgs;

        if (requestedOrgId != null) {
            Organization org = organizationRepository.findById(requestedOrgId)
                    .orElseThrow(() -> new RuntimeException("Szervezet nem található"));

            if (user.getRole() != Role.SYS_ADMIN) {
                boolean isMember = user.getMemberships().stream()
                        .anyMatch(m -> m.getOrganization().getId().equals(requestedOrgId) && m.getStatus() == MembershipStatus.APPROVED);
                if (!isMember) throw new RuntimeException("Nincs jogosultságod ehhez a szervezethez!");
            }
            targetOrgs = List.of(org);
        } else {
            if (user.getRole() == Role.SYS_ADMIN) {
                targetOrgs = organizationRepository.findAll();
            } else {
                targetOrgs = user.getMemberships().stream()
                        .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                        .map(OrganizationMember::getOrganization)
                        .collect(Collectors.toList());
            }
        }

        if (targetOrgs.isEmpty()) return Page.empty(pageable);

        List<Long> targetOrgIds = targetOrgs.stream()
                .map(Organization::getId)
                .collect(Collectors.toList());

        String originalTenant = TenantContext.getCurrentTenant();

        try {
            TenantContext.setCurrentTenant(null);

            Page<Event> masterEvents = eventRepository.findByOrganizationIdIn(targetOrgIds, pageable);

            return masterEvents.map(event -> {
                Organization org = event.getOrganization();
                return new EventDTO(
                        event.getId(),
                        event.getTitle(),
                        event.getDescription(),
                        event.getLocation(),
                        event.getStartTime(),
                        event.getEndTime(),
                        event.getApplicationDeadline(),
                        event.isRegistrationOpen(),
                        event.getBannerUrl(),
                        List.of(),
                        List.of(),
                        org != null ? new OrganizationDTO(
                                org.getId(), org.getName(), org.getTenantId(),
                                org.getAddress(), org.getDescription(), org.getEmail(), org.getPhone(),
                                org.getLogoUrl(), org.getBannerUrl()
                        ) : null
                );
            });
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @Transactional(readOnly = true)
    public Page<EventDTO> getPublicEventsFromMaster(Pageable pageable) {
        String originalTenant = TenantContext.getCurrentTenant();

        try {
            TenantContext.setCurrentTenant(null);
            Page<Event> masterEvents = eventRepository.findAll(pageable);

            return masterEvents.map(event -> {
                Organization org = event.getOrganization();
                return new EventDTO(
                        event.getId(),
                        event.getTitle(),
                        event.getDescription(),
                        event.getLocation(),
                        event.getStartTime(),
                        event.getEndTime(),
                        event.getApplicationDeadline(),
                        event.isRegistrationOpen(),
                        event.getBannerUrl(),
                        List.of(),
                        List.of(),
                        org != null ? new OrganizationDTO(
                                org.getId(), org.getName(), org.getTenantId(),
                                org.getAddress(), org.getDescription(), org.getEmail(), org.getPhone(),
                                org.getLogoUrl(), org.getBannerUrl()
                        ) : null
                );
            });
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public List<EventDTO> fetchEventDTOsForTenant(Organization org) {
        List<Event> events = eventRepository.findAll();
        List<EventDTO> dtos = new ArrayList<>();
        for (Event e : events) {
            dtos.add(convertToDTOWithOrg(e, org));
        }
        return dtos;
    }

    @Transactional(readOnly = true)
    public EventDTO getEventDTOById(Long id) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.setCurrentTenant(null);
            Event masterEvent = eventRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Esemény nem található!"));

            Organization org = masterEvent.getOrganization();

            if (org != null && org.getTenantId() != null && !org.getTenantId().trim().isEmpty()) {
                TenantContext.setCurrentTenant(org.getTenantId());
                return self.fetchFullEventDTOInTenant(id, org);
            }

            return convertToDTOWithOrg(masterEvent, org);
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public EventDTO fetchFullEventDTOInTenant(Long id, Organization org) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Esemény nem található a bérlőben!"));
        return convertToDTOWithOrg(event, org);
    }

    @Transactional(readOnly = true)
    public Event getEventById(Long id) {
        return eventRepository.findById(id).orElseThrow();
    }

    @Transactional
    public EventDTO updateEvent(Long id, EventDTO dto, String requesterEmail) { // <--- Visszatérési típus EventDTO
        Event event = eventRepository.findById(id).orElseThrow();
        Long orgId = event.getOrganization().getId();

        // Itt van a korábbi jó szűrésünk a személyes elfoglaltságokra
        List<Shift> existingShifts = shiftRepository.findByEventId(id).stream()
                .filter(shift -> shift.getWorkArea() != null)
                .collect(Collectors.toList());

        for (Shift shift : existingShifts) {
            if (shift.getStartTime().isBefore(dto.startTime()) || shift.getEndTime().isAfter(dto.endTime())) {
                throw new RuntimeException("Nem módosíthatod az esemény időtartamát, mert kilógna egy meglévő műszak!");
            }
        }

        event.setTitle(dto.title());
        event.setDescription(dto.description());
        event.setLocation(dto.location());
        event.setStartTime(dto.startTime());
        event.setEndTime(dto.endTime());

        event.setApplicationDeadline(dto.applicationDeadline());
        if (dto.isRegistrationOpen() != null) {
            event.setRegistrationOpen(dto.isRegistrationOpen());
        }

        if (dto.workAreas() != null) {
            List<Long> incomingWaIds = dto.workAreas().stream().filter(w -> w.id() != null).map(WorkAreaDTO::id).collect(Collectors.toList());
            event.getWorkAreas().removeIf(existingWa -> !incomingWaIds.contains(existingWa.getId()));

            for (WorkAreaDTO waDto : dto.workAreas()) {
                if (waDto.id() != null) {
                    event.getWorkAreas().stream().filter(wa -> wa.getId().equals(waDto.id())).findFirst()
                            .ifPresent(existingWa -> {
                                existingWa.setName(waDto.name());
                                existingWa.setDescription(waDto.description());
                                existingWa.setCapacity(waDto.capacity());
                            });
                } else {
                    event.getWorkAreas().add(WorkArea.builder().name(waDto.name()).description(waDto.description()).capacity(waDto.capacity()).event(event).build());
                }
            }
        } else {
            event.getWorkAreas().clear();
        }

        if (dto.questions() != null) {
            List<Long> incomingQIds = dto.questions().stream().filter(q -> q.id() != null).map(EventQuestionDTO::id).collect(Collectors.toList());
            event.getQuestions().removeIf(existingQ -> !incomingQIds.contains(existingQ.getId()));

            for (EventQuestionDTO qDto : dto.questions()) {
                if (qDto.id() != null) {
                    event.getQuestions().stream().filter(q -> q.getId().equals(qDto.id())).findFirst()
                            .ifPresent(existingQ -> {
                                existingQ.setQuestionText(qDto.questionText());
                                existingQ.setQuestionType(qDto.questionType());
                                existingQ.setOptions(qDto.options());
                                existingQ.setRequired(qDto.isRequired());
                            });
                } else {
                    event.getQuestions().add(EventQuestion.builder().questionText(qDto.questionText()).questionType(qDto.questionType()).options(qDto.options()).isRequired(qDto.isRequired()).event(event).build());
                }
            }
        } else {
            event.getQuestions().clear();
        }

        Event updatedEvent = eventRepository.save(event);
        updateEventInMaster(updatedEvent);

        auditLogService.logAction(requesterEmail, "EVENT_UPDATED", "Esemény: " + updatedEvent.getTitle(), "Módosult.", orgId);

        // JAVÍTÁS: Nyers entitás helyett tiszta JSON barát DTO-t adunk vissza!
        return convertToDTO(updatedEvent);
    }

    @Transactional
    public void deleteEvent(Long id, String requesterEmail) {
        Event event = eventRepository.findById(id).orElseThrow(() -> new RuntimeException("Esemény nem található"));
        Long orgId = event.getOrganization().getId();
        String eventTitle = event.getTitle();

        eventRepository.deleteById(id);
        deleteEventFromMaster(id);

        auditLogService.logAction(requesterEmail, "EVENT_DELETED", "Esemény: " + eventTitle, "Véglegesen törölve.", orgId);
    }

    private EventDTO convertToDTO(Event event) {
        return new EventDTO(
                event.getId(), event.getTitle(), event.getDescription(), event.getLocation(),
                event.getStartTime(), event.getEndTime(),
                event.getApplicationDeadline(), event.isRegistrationOpen(),
                event.getBannerUrl(),
                event.getWorkAreas().stream().map(wa -> new WorkAreaDTO(wa.getId(), wa.getName(), wa.getDescription(), wa.getCapacity(), List.of())).toList(),
                event.getQuestions().stream().map(q -> new EventQuestionDTO(q.getId(), q.getQuestionText(), q.getQuestionType(), q.getOptions(), q.isRequired())).toList(),
                new OrganizationDTO(event.getOrganization().getId(), event.getOrganization().getName(), event.getOrganization().getTenantId(), event.getOrganization().getAddress(), event.getOrganization().getDescription(), event.getOrganization().getEmail(), event.getOrganization().getPhone(), event.getOrganization().getLogoUrl(), event.getOrganization().getBannerUrl())
        );
    }

    private EventDTO convertToDTOWithOrg(Event event, Organization org) {
        return new EventDTO(
                event.getId(), event.getTitle(), event.getDescription(), event.getLocation(),
                event.getStartTime(), event.getEndTime(),
                event.getApplicationDeadline(), event.isRegistrationOpen(),
                event.getBannerUrl(),
                event.getWorkAreas().stream().map(wa -> new WorkAreaDTO(wa.getId(), wa.getName(), wa.getDescription(), wa.getCapacity(), List.of())).toList(),
                event.getQuestions().stream().map(q -> new EventQuestionDTO(q.getId(), q.getQuestionText(), q.getQuestionType(), q.getOptions(), q.isRequired())).toList(),
                new OrganizationDTO(org.getId(), org.getName(), org.getTenantId(), org.getAddress(), org.getDescription(), org.getEmail(), org.getPhone(), org.getLogoUrl(), org.getBannerUrl())
        );
    }

    @Transactional(readOnly = true)
    public List<WorkAreaDTO> getWorkAreasByEventId(Long eventId) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.setCurrentTenant(null);
            Event masterEvent = eventRepository.findById(eventId)
                    .orElseThrow(() -> new RuntimeException("Esemény nem található!"));

            Organization org = masterEvent.getOrganization();

            if (org != null && org.getTenantId() != null && !org.getTenantId().trim().isEmpty()) {
                TenantContext.setCurrentTenant(org.getTenantId());
                return self.fetchWorkAreasInTenant(eventId);
            }
            return List.of();
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public List<WorkAreaDTO> fetchWorkAreasInTenant(Long eventId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Esemény nem található!"));
        return event.getWorkAreas().stream()
                .map(area -> new WorkAreaDTO(area.getId(), area.getName(), area.getDescription(), area.getCapacity(), List.of()))
                .collect(Collectors.toList());
    }

    private void syncEventToMaster(Event event, Long orgId) {
        try (java.sql.Connection conn = java.sql.DriverManager.getConnection("jdbc:postgresql://localhost:5432/master_db", "postgres", "jelszo")) {
            String sql = "INSERT INTO events (id, title, description, location, start_time, end_time, application_deadline, is_registration_open, organization_id, banner_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            try (java.sql.PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setLong(1, event.getId());
                ps.setString(2, event.getTitle());
                ps.setString(3, event.getDescription());
                ps.setString(4, event.getLocation());
                ps.setTimestamp(5, java.sql.Timestamp.valueOf(event.getStartTime()));
                ps.setTimestamp(6, java.sql.Timestamp.valueOf(event.getEndTime()));

                if (event.getApplicationDeadline() != null) {
                    ps.setTimestamp(7, java.sql.Timestamp.valueOf(event.getApplicationDeadline()));
                } else {
                    ps.setNull(7, java.sql.Types.TIMESTAMP);
                }

                ps.setBoolean(8, event.isRegistrationOpen());
                ps.setLong(9, orgId);

                if (event.getBannerUrl() != null) {
                    ps.setString(10, event.getBannerUrl());
                } else {
                    ps.setNull(10, java.sql.Types.VARCHAR);
                }

                ps.executeUpdate();
                System.out.println("✅ Esemény (Kirakat) sikeresen átmásolva a Mester DB-be!");
            }
        } catch (Exception e) {
            System.err.println("⚠️ Hiba a Mester DB szinkronizációban (Create): " + e.getMessage());
        }
    }

    public void updateEventInMaster(Event event) {
        try (java.sql.Connection conn = java.sql.DriverManager.getConnection("jdbc:postgresql://localhost:5432/master_db", "postgres", "jelszo")) {
            String sql = "UPDATE events SET title=?, description=?, location=?, start_time=?, end_time=?, application_deadline=?, is_registration_open=?, banner_url=? WHERE id=?";
            try (java.sql.PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, event.getTitle());
                ps.setString(2, event.getDescription());
                ps.setString(3, event.getLocation());
                ps.setTimestamp(4, java.sql.Timestamp.valueOf(event.getStartTime()));
                ps.setTimestamp(5, java.sql.Timestamp.valueOf(event.getEndTime()));

                if (event.getApplicationDeadline() != null) {
                    ps.setTimestamp(6, java.sql.Timestamp.valueOf(event.getApplicationDeadline()));
                } else {
                    ps.setNull(6, java.sql.Types.TIMESTAMP);
                }

                ps.setBoolean(7, event.isRegistrationOpen());

                if (event.getBannerUrl() != null) {
                    ps.setString(8, event.getBannerUrl());
                } else {
                    ps.setNull(8, java.sql.Types.VARCHAR);
                }

                ps.setLong(9, event.getId());

                ps.executeUpdate();
                System.out.println("✅ Esemény (Kirakat) sikeresen frissítve a Mester DB-ben!");
            }
        } catch (Exception e) {
            System.err.println("⚠️ Hiba a Mester DB szinkronizációban (Update): " + e.getMessage());
        }
    }

    private void deleteEventFromMaster(Long eventId) {
        try (java.sql.Connection conn = java.sql.DriverManager.getConnection("jdbc:postgresql://localhost:5432/master_db", "postgres", "jelszo")) {
            String sql = "UPDATE events SET deleted_at = CURRENT_TIMESTAMP WHERE id=?";
            try (java.sql.PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setLong(1, eventId);
                ps.executeUpdate();
                System.out.println("✅ Esemény (Kirakat) logikailag törölve a Mester DB-ből!");
            }
        } catch (Exception e) {
            System.err.println("⚠️ Hiba a Mester DB szinkronizációban (Soft Delete): " + e.getMessage());
        }
    }

    @Transactional
    public String syncAllLegacyEventsToMaster() {
        List<Organization> orgs = organizationRepository.findAll();
        int syncedCount = 0;
        int failedCount = 0;
        int skippedOrgCount = 0;
        StringBuilder errorLog = new StringBuilder();
        String originalTenant = TenantContext.getCurrentTenant();

        try (java.sql.Connection conn = java.sql.DriverManager.getConnection("jdbc:postgresql://localhost:5432/master_db", "postgres", "jelszo")) {

            String sql = "INSERT INTO events (id, title, description, location, start_time, end_time, application_deadline, is_registration_open, organization_id, banner_url) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
                    "ON CONFLICT (id) DO UPDATE SET " +
                    "title = EXCLUDED.title, description = EXCLUDED.description, location = EXCLUDED.location, " +
                    "start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, " +
                    "application_deadline = EXCLUDED.application_deadline, is_registration_open = EXCLUDED.is_registration_open, " +
                    "organization_id = EXCLUDED.organization_id, banner_url = EXCLUDED.banner_url";

            for (Organization org : orgs) {
                if (org.getTenantId() != null && !org.getTenantId().trim().isEmpty()) {
                    TenantContext.setCurrentTenant(org.getTenantId());

                    List<Event> tenantEvents = self.getAllEventsForSync();

                    for (Event event : tenantEvents) {
                        try (java.sql.PreparedStatement ps = conn.prepareStatement(sql)) {
                            ps.setLong(1, event.getId());
                            ps.setString(2, event.getTitle());
                            ps.setString(3, event.getDescription());
                            ps.setString(4, event.getLocation());
                            ps.setTimestamp(5, java.sql.Timestamp.valueOf(event.getStartTime()));
                            ps.setTimestamp(6, java.sql.Timestamp.valueOf(event.getEndTime()));

                            if (event.getApplicationDeadline() != null) {
                                ps.setTimestamp(7, java.sql.Timestamp.valueOf(event.getApplicationDeadline()));
                            } else {
                                ps.setNull(7, java.sql.Types.TIMESTAMP);
                            }

                            ps.setBoolean(8, event.isRegistrationOpen());
                            ps.setLong(9, org.getId());

                            if (event.getBannerUrl() != null) {
                                ps.setString(10, event.getBannerUrl());
                            } else {
                                ps.setNull(10, java.sql.Types.VARCHAR);
                            }

                            ps.executeUpdate();
                            syncedCount++;
                        } catch (Exception ex) {
                            failedCount++;
                            errorLog.append("[Esemény ID: ").append(event.getId()).append(" - ").append(ex.getMessage()).append("] ");
                        }
                    }
                } else {
                    skippedOrgCount++;
                }
            }
        } catch (Exception e) {
            return "Kritikus hiba a szinkronizálás során: " + e.getMessage();
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }

        return "Szinkronizáció kész! \n" +
                "✅ Sikeres: " + syncedCount + " db \n" +
                "❌ Hibás: " + failedCount + " db \n" +
                "⏭️ Kihagyott szervezetek (nincs tenant_id): " + skippedOrgCount + " db \n" +
                (failedCount > 0 ? "Hibák részletei: " + errorLog.toString() : "");
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public List<Event> getAllEventsForSync() {
        return eventRepository.findAll();
    }

    // =======================================================================
    // JAVÍTVA: ELÉRHETŐSÉGEK / KAPCSOLATTARTÓK LEKÉRÉSE (DUPLA TRANZAKCIÓVAL)
    // =======================================================================
    public List<Map<String, Object>> getEventContacts(Long eventId) {

        // 1. FÁZIS: Adatok kinyerése a Tenant (Szervezet) adatbázisából egy dedikált tranzakcióban
        Map<String, Object> tenantData = transactionTemplate.execute(status -> {
            Event event = eventRepository.findById(eventId).orElseThrow(() -> new RuntimeException("Esemény nem található"));
            Long orgId = event.getOrganization().getId();

            List<EventTeamMember> localTeam = eventTeamMemberRepository.findByEventId(eventId);
            Map<Long, String> coordAreaMap = new HashMap<>();

            for (EventTeamMember tm : localTeam) {
                if (tm.getRole() == EventRole.COORDINATOR) {
                    List<String> managedAreas = event.getWorkAreas().stream()
                            .filter(wa -> wa.getCoordinatorIds() != null && wa.getCoordinatorIds().contains(tm.getUserId()))
                            .map(WorkArea::getName)
                            .collect(Collectors.toList());
                    coordAreaMap.put(tm.getUserId(), managedAreas.isEmpty() ? "Nincs kiosztott terület" : String.join(", ", managedAreas));
                }
            }

            Map<String, Object> data = new HashMap<>();
            data.put("orgId", orgId);
            data.put("coordAreaMap", coordAreaMap);
            return data;
        });

        Long orgId = (Long) tenantData.get("orgId");
        @SuppressWarnings("unchecked")
        Map<Long, String> coordinatorAreaMap = (Map<Long, String>) tenantData.get("coordAreaMap");

        List<Map<String, Object>> contacts = new ArrayList<>();
        String originalTenant = TenantContext.getCurrentTenant();

        try {
            // 2. FÁZIS: VÁLTÁS A MASTER ADATBÁZISRA!
            TenantContext.setCurrentTenant(null);

            // ÚJ TRANZAKCIÓ NYITÁSA A MASTERBEN (Itt vannak a telefonok és a valódi Alapítók!)
            transactionTemplate.execute(status -> {
                List<Long> addedUserIds = new ArrayList<>();

                // A) Szervezet Alapítók és Szervezők (Az igazi Főszervezők)
                Organization masterOrg = organizationRepository.findById(orgId).orElse(null);
                if (masterOrg != null && masterOrg.getMembers() != null) {
                    Hibernate.initialize(masterOrg.getMembers());
                    for (OrganizationMember m : masterOrg.getMembers()) {
                        if (m.getStatus() == MembershipStatus.APPROVED &&
                                (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER)) {

                            User u = m.getUser();
                            Map<String, Object> contact = new HashMap<>();
                            contact.put("name", u.getName());
                            contact.put("role", "Főszervező");
                            contact.put("workAreaName", "Globális (Minden terület)");
                            contact.put("phone", u.getPhoneNumber() != null && !u.getPhoneNumber().trim().isEmpty() ? u.getPhoneNumber() : "Nincs megadva");
                            contact.put("email", u.getEmail());
                            contact.put("avatar", u.getProfileImageUrl());
                            contacts.add(contact);
                            addedUserIds.add(u.getId());
                        }
                    }
                }

                // B) A Tenantból áthozott Koordinátorok adatainak kiegészítése
                for (Long coordId : coordinatorAreaMap.keySet()) {
                    if (!addedUserIds.contains(coordId)) {
                        User u = userRepository.findById(coordId).orElse(null);
                        if (u != null) {
                            Map<String, Object> contact = new HashMap<>();
                            contact.put("name", u.getName());
                            contact.put("role", "Koordinátor");
                            contact.put("workAreaName", coordinatorAreaMap.get(coordId));
                            contact.put("phone", u.getPhoneNumber() != null && !u.getPhoneNumber().trim().isEmpty() ? u.getPhoneNumber() : "Nincs megadva");
                            contact.put("email", u.getEmail());
                            contact.put("avatar", u.getProfileImageUrl());
                            contacts.add(contact);
                            addedUserIds.add(u.getId());
                        }
                    }
                }
                return null;
            });

        } finally {
            // 3. Visszaváltás a Tenant adatbázisra
            TenantContext.setCurrentTenant(originalTenant);
        }

        return contacts;
    }
}