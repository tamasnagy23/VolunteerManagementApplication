package com.example.volunteermanagement.service;

import com.example.volunteermanagement.tenant.TenantContext;
import com.example.volunteermanagement.dto.*;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShiftService {

    private final ShiftRepository shiftRepository;
    private final ApplicationRepository applicationRepository;
    private final AuditLogService auditLogService;
    private final WorkAreaRepository workAreaRepository;
    private final UserRepository userRepository;
    private final ShiftAssignmentRepository shiftAssignmentRepository;
    private final EventRepository eventRepository;
    private final OrganizationRepository organizationRepository;
    private final EventTeamMemberRepository eventTeamMemberRepository;

    @Autowired
    @Lazy
    private ShiftService self;

    @Transactional(readOnly = true)
    public List<ShiftDTO> getShiftsByEvent(Long eventId) {
        String originalTenant = TenantContext.getCurrentTenant();
        List<ShiftDTO> resultDtos = new ArrayList<>();

        // 1. Elfogadott önkéntesek és App ID-k kigyűjtése az aktuális Tenantból
        List<Application> approvedApps = applicationRepository.findByEventId(eventId).stream()
                .filter(app -> app.getStatus() == ApplicationStatus.APPROVED)
                .collect(Collectors.toList());

        List<Long> approvedUserIds = approvedApps.stream()
                .map(Application::getUserId)
                .collect(Collectors.toList());

        // 2. Aktuális Tenant műszakjai (Sima munka és Globális gyűlés)
        List<Shift> tenantShifts = shiftRepository.findAll().stream()
                .filter(s -> (s.getWorkArea() != null && s.getWorkArea().getEvent().getId().equals(eventId)) ||
                        (s.getEvent() != null && s.getEvent().getId().equals(eventId)))
                .collect(Collectors.toList());

        resultDtos.addAll(mapShiftsToDTOs(tenantShifts, eventId));

        // 3. JAVÍTÁS: Átváltunk a Globális sémára, és egy ÚJ tranzakcióban kérjük le az adatokat!
        try {
            TenantContext.setCurrentTenant(null);

            // Itt kötelező a 'self.' hívás, hogy kikényszerítse az ÚJ tranzakciót (REQUIRES_NEW)
            List<ShiftDTO> personalShifts = self.fetchPersonalShiftsForUsers(approvedUserIds);

            // Visszatöltjük a Tenant specifikus Application ID-kat, hogy a szervező tudjon rájuk kattintani
            for (ShiftDTO shiftDto : personalShifts) {
                List<AssignedUserDTO> updatedUsers = new ArrayList<>();
                for (AssignedUserDTO au : shiftDto.assignedUsers()) {
                    Long appId = approvedApps.stream()
                            .filter(app -> app.getUserId().equals(au.userId()))
                            .map(Application::getId)
                            .findFirst()
                            .orElse(null);

                    updatedUsers.add(new AssignedUserDTO(appId, au.userId(), au.name(), au.email(), au.status(), au.message(), au.isBackup()));
                }

                resultDtos.add(new ShiftDTO(
                        shiftDto.id(), null, "Személyes elfoglaltság", shiftDto.name(), shiftDto.startTime(), shiftDto.endTime(),
                        shiftDto.maxVolunteers(), shiftDto.maxBackupVolunteers(), "PERSONAL", shiftDto.description(), updatedUsers
                ));
            }

        } catch (Exception e) {
            System.err.println("Globális személyes műszakok olvasása hiba: " + e.getMessage());
            e.printStackTrace();
        } finally {
            TenantContext.setCurrentTenant(originalTenant); // Visszaváltás az eredeti szervezetre
        }

        return resultDtos;
    }

    // --- ÚJ METÓDUS: Külön tranzakció (új adatbázis kapcsolat) a globális lekérdezéshez! ---
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public List<ShiftDTO> fetchPersonalShiftsForUsers(List<Long> userIds) {
        List<Shift> personalShifts = shiftRepository.findAll().stream()
                .filter(s -> s.getType() == ShiftType.PERSONAL)
                .filter(s -> s.getAssignments().stream().anyMatch(a -> userIds.contains(a.getUserId())))
                .collect(Collectors.toList());

        return personalShifts.stream().map(shift -> {
            List<AssignedUserDTO> assignedUsers = shift.getAssignments().stream()
                    .map(assignment -> {
                        User user = userRepository.findById(assignment.getUserId()).orElse(null);
                        return new AssignedUserDTO(
                                null, // Ezt a hívó majd pótolja az eredeti Tenantból!
                                assignment.getUserId(),
                                user != null ? user.getName() : "Ismeretlen",
                                user != null ? user.getEmail() : "Ismeretlen",
                                assignment.getStatus().name(),
                                assignment.getMessage(),
                                assignment.isBackup()
                        );
                    }).collect(Collectors.toList());

            return new ShiftDTO(
                    shift.getId(), null, "Személyes", shift.getName(), shift.getStartTime(), shift.getEndTime(),
                    shift.getMaxVolunteers(), shift.getMaxBackupVolunteers(), "PERSONAL", shift.getDescription(), assignedUsers
            );
        }).collect(Collectors.toList());
    }

    private List<ShiftDTO> mapShiftsToDTOs(List<Shift> shifts, Long eventId) {

        // JAVÍTÁS: Betöltjük a csapatot, hogy tudjuk ki a vezető!
        List<EventTeamMember> teamMembers = eventTeamMemberRepository.findByEventId(eventId);
        List<Long> leaderIds = teamMembers.stream()
                .filter(tm -> tm.getRole() == EventRole.ORGANIZER || tm.getRole() == EventRole.COORDINATOR)
                .map(EventTeamMember::getUserId)
                .collect(Collectors.toList());

        return shifts.stream().map(shift -> {
            List<AssignedUserDTO> assignedUsers = shift.getAssignments().stream()
                    // LÁGY SZŰRÉS: Ha a beosztott személy benne van a vezetők listájában, kihagyjuk!
                    .filter(assignment -> !leaderIds.contains(assignment.getUserId()))
                    .map(assignment -> {
                        User user = userRepository.findById(assignment.getUserId()).orElse(null);
                        Long appId = applicationRepository.findByUserIdAndEventId(assignment.getUserId(), eventId).stream()
                                .map(Application::getId).findFirst().orElse(null);

                        return new AssignedUserDTO(appId, assignment.getUserId(),
                                user != null ? user.getName() : "Ismeretlen",
                                user != null ? user.getEmail() : "Ismeretlen",
                                assignment.getStatus().name(), assignment.getMessage(), assignment.isBackup());
                    }).collect(Collectors.toList());

            return new ShiftDTO(shift.getId(), shift.getWorkArea() != null ? shift.getWorkArea().getId() : null,
                    shift.getWorkArea() != null ? shift.getWorkArea().getName() : (shift.getType() == ShiftType.PERSONAL ? "Személyes" : "Globális"),
                    shift.getName(), shift.getStartTime(), shift.getEndTime(), shift.getMaxVolunteers(), shift.getMaxBackupVolunteers(),
                    shift.getType() != null ? shift.getType().name() : "WORK", shift.getDescription(), assignedUsers);
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<MyShiftDTO> getMyShifts(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található!"));

        List<Organization> userOrgs;

        if (user.getRole() == Role.SYS_ADMIN) {
            userOrgs = organizationRepository.findAll();
        } else {
            userOrgs = user.getMemberships().stream()
                    .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                    .map(OrganizationMember::getOrganization)
                    .collect(Collectors.toList());
        }

        List<MyShiftDTO> allMyShifts = new ArrayList<>();
        String originalTenant = TenantContext.getCurrentTenant();

        try {
            TenantContext.setCurrentTenant(null);
            allMyShifts.addAll(self.fetchMyShiftsForTenant(user));

            for (Organization org : userOrgs) {
                if (org.getTenantId() != null && !org.getTenantId().trim().isEmpty()) {
                    TenantContext.setCurrentTenant(org.getTenantId());
                    allMyShifts.addAll(self.fetchMyShiftsForTenant(user));
                }
            }
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }

        return allMyShifts;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public List<MyShiftDTO> fetchMyShiftsForTenant(User user) {

        // LÁGY SZŰRÉS 1: Kiderítjük, mely eseményeken lett a tag Vezető (Főszervező vagy Koordinátor)
        List<Long> leaderEventIds = eventTeamMemberRepository.findByUserId(user.getId()).stream()
                .filter(tm -> tm.getRole() == EventRole.ORGANIZER || tm.getRole() == EventRole.COORDINATOR)
                .filter(tm -> tm.getEvent() != null)
                .map(tm -> tm.getEvent().getId())
                .collect(Collectors.toList());

        // A beosztások lekérése
        List<ShiftAssignment> assignments = shiftAssignmentRepository.findByUserId(user.getId()).stream()
                .filter(a -> {
                    Shift shift = a.getShift();
                    // A Személyes elfoglaltságokat mindig mutatjuk a naptárban!
                    if (shift.getType() == ShiftType.PERSONAL) return true;

                    Long eventId = shift.getEvent() != null ? shift.getEvent().getId() :
                            (shift.getWorkArea() != null ? shift.getWorkArea().getEvent().getId() : null);

                    // LÁGY SZŰRÉS 2: Ha a felhasználó Vezető ezen az eseményen, akkor ELREJTJÜK a sima beosztásait a naptárából!
                    return eventId == null || !leaderEventIds.contains(eventId);
                })
                .collect(Collectors.toList());

        return assignments.stream().map(assignment -> {
            Shift shift = assignment.getShift();

            String eventTitle = null;
            if (shift.getType() != ShiftType.PERSONAL) {
                eventTitle = shift.getWorkArea() != null ? shift.getWorkArea().getEvent().getTitle() : (shift.getEvent() != null ? shift.getEvent().getTitle() : "Ismeretlen Esemény");
            }

            String workAreaName = shift.getWorkArea() != null ? shift.getWorkArea().getName() : (shift.getType() == ShiftType.MEETING ? "Globális Gyűlés" : "Személyes elfoglaltság");

            List<String> coWorkers = shift.getAssignments().stream()
                    .filter(a -> !a.getUserId().equals(user.getId()))
                    .map(a -> {
                        User coWorker = userRepository.findById(a.getUserId()).orElse(null);
                        String name = coWorker != null ? coWorker.getName() : "Ismeretlen";
                        return name + (a.isBackup() ? " (Beugró)" : "");
                    })
                    .collect(Collectors.toList());

            return new MyShiftDTO(
                    assignment.getId(),
                    shift.getId(),
                    eventTitle,
                    workAreaName,
                    shift.getName(),
                    shift.getStartTime().toString(),
                    shift.getEndTime().toString(),
                    assignment.getStatus().name(),
                    assignment.getMessage(),
                    shift.getType() != null ? shift.getType().name() : "WORK",
                    shift.getDescription(),
                    coWorkers,
                    TenantContext.getCurrentTenant()
            );
        }).collect(Collectors.toList());
    }

    @Transactional
    public void updateAssignmentStatus(Long assignmentId, UpdateAssignmentStatusRequest request, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található!"));

        ShiftAssignment assignment = shiftAssignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new RuntimeException("Beosztás nem található!"));

        if (!assignment.getUserId().equals(user.getId())) {
            throw new RuntimeException("Nincs jogosultságod módosítani ezt a beosztást!");
        }

        assignment.setStatus(AssignmentStatus.valueOf(request.status()));
        assignment.setMessage(request.message());

        shiftAssignmentRepository.save(assignment);

        Long orgId = assignment.getShift().getEvent() != null ? assignment.getShift().getEvent().getOrganization().getId() : null;

        auditLogService.logAction(userEmail, "SHIFT_STATUS_UPDATE",
                "Beosztás státusza módosítva: " + request.status(),
                "Üzenet: " + request.message(),
                orgId);
    }

    @Transactional
    public void assignUsersToShift(Long shiftId, AssignShiftRequest request, String requesterEmail) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new RuntimeException("Műszak nem található!"));

        List<Application> normalApps = applicationRepository.findAllById(request.applicationIds());
        List<Application> backupApps = applicationRepository.findAllById(request.backupApplicationIds());

        List<Application> allApps = new ArrayList<>();
        allApps.addAll(normalApps);
        allApps.addAll(backupApps);

        if (!allApps.stream().allMatch(app -> app.getStatus() == ApplicationStatus.APPROVED)) {
            throw new RuntimeException("Csak elfogadott jelentkezőket oszthatsz be!");
        }

        if (shift.getType() != ShiftType.MEETING) {
            long currentNormal = shift.getAssignments().stream().filter(a -> !a.isBackup()).count();
            if (currentNormal + normalApps.size() > shift.getMaxVolunteers()) {
                throw new RuntimeException("A rendes műszak betelt!");
            }

            long currentBackup = shift.getAssignments().stream().filter(ShiftAssignment::isBackup).count();
            if (currentBackup + backupApps.size() > shift.getMaxBackupVolunteers()) {
                throw new RuntimeException("A beugró/készenléti létszámkeret betelt!");
            }
        }

        boolean isNight = isNightShift(shift.getStartTime(), shift.getEndTime());

        for (Application app : normalApps) {
            User user = userRepository.findById(app.getUserId()).orElseThrow();
            processAssignment(shift, user, false, isNight);
        }
        for (Application app : backupApps) {
            User user = userRepository.findById(app.getUserId()).orElseThrow();
            processAssignment(shift, user, true, isNight);
        }

        shiftRepository.save(shift);

        String normalNames = normalApps.stream()
                .map(a -> userRepository.findById(a.getUserId()).map(User::getName).orElse("Ismeretlen"))
                .collect(Collectors.joining(", "));
        String backupNames = backupApps.stream()
                .map(a -> userRepository.findById(a.getUserId()).map(User::getName).orElse("Ismeretlen"))
                .collect(Collectors.joining(", "));

        Long orgId = shift.getEvent() != null ? shift.getEvent().getOrganization().getId() : null;
        String areaName = shift.getWorkArea() != null ? shift.getWorkArea().getName() : "Globális Gyűlés";

        String logMessage = normalApps.size() + " normál tag: " + normalNames;
        if (!backupApps.isEmpty()) logMessage += " | " + backupApps.size() + " beugró: " + backupNames;

        auditLogService.logAction(requesterEmail, "ASSIGN_SHIFT", "Beosztás: " + areaName, logMessage, orgId);
    }

    private void processAssignment(Shift shift, User user, boolean isBackup, boolean isNight) {
        List<ShiftAssignment> userAssignments = shiftAssignmentRepository.findByUserId(user.getId());

        for (ShiftAssignment assignment : userAssignments) {
            Shift existingShift = assignment.getShift();
            boolean isOverlapping = existingShift.getStartTime().isBefore(shift.getEndTime()) &&
                    existingShift.getEndTime().isAfter(shift.getStartTime());

            if (isOverlapping) {
                String areaName = existingShift.getWorkArea() != null ? existingShift.getWorkArea().getName() : "Más elfoglaltság";
                throw new RuntimeException("Időpont ütközés! " + user.getName() +
                        " már be van osztva máshova ebben az időszakban: " + areaName +
                        " (" + existingShift.getStartTime().toLocalTime() + " - " +
                        existingShift.getEndTime().toLocalTime() + ")");
            }
        }

        if (isNight) {
            if (user.getDateOfBirth() == null) {
                throw new RuntimeException("Munkajogi hiba: " + user.getName() + " profiljában nincs megadva születési dátum!");
            }
            LocalDate shiftDate = shift.getStartTime().toLocalDate();
            int ageAtShift = Period.between(user.getDateOfBirth(), shiftDate).getYears();
            if (ageAtShift < 18) {
                throw new RuntimeException("Munkajogi hiba: Kiskorú önkéntes (" + user.getName() + ") nem osztható be éjszakai műszakba!");
            }
        }

        ShiftAssignment newAssignment = ShiftAssignment.builder()
                .shift(shift)
                .userId(user.getId())
                .status(AssignmentStatus.PENDING)
                .isBackup(isBackup)
                .build();

        shift.getAssignments().add(newAssignment);
    }

    @Transactional
    public void removeUserFromShift(Long shiftId, Long applicationId, String requesterEmail) {
        Shift shift = shiftRepository.findById(shiftId).orElseThrow(() -> new RuntimeException("Műszak nem található!"));
        Application application = applicationRepository.findById(applicationId).orElseThrow(() -> new RuntimeException("Jelentkezés nem található!"));

        ShiftAssignment assignment = shiftAssignmentRepository.findByShiftIdAndUserId(shiftId, application.getUserId())
                .orElseThrow(() -> new RuntimeException("Ez az önkéntes nincs beosztva ebbe a műszakba!"));

        shift.getAssignments().remove(assignment);
        shiftAssignmentRepository.delete(assignment);
        shiftRepository.save(shift);

        Long orgId = shift.getEvent() != null ? shift.getEvent().getOrganization().getId() : null;
        String areaName = shift.getWorkArea() != null ? shift.getWorkArea().getName() : "Globális Gyűlés";

        User targetUser = userRepository.findById(application.getUserId()).orElse(null);
        String targetName = targetUser != null ? targetUser.getName() : "Ismeretlen";

        auditLogService.logAction(requesterEmail, "REMOVE_FROM_SHIFT", "Törlés innen: " + areaName,
                "Eltávolított önkéntes: " + targetName, orgId);
    }

    @Transactional
    public ShiftDTO createGlobalShift(Long eventId, ShiftDTO dto, String requesterEmail) {
        Event event = eventRepository.findById(eventId).orElseThrow(() -> new RuntimeException("Esemény nem található"));

        Shift shift = Shift.builder()
                .event(event)
                .workArea(null)
                .name(dto.name())
                .startTime(dto.startTime())
                .endTime(dto.endTime())
                .maxVolunteers(dto.maxVolunteers())
                .maxBackupVolunteers(0)
                .type(ShiftType.MEETING)
                .description(dto.description())
                .assignments(new ArrayList<>())
                .build();

        Shift saved = shiftRepository.save(shift);

        auditLogService.logAction(requesterEmail, "CREATE_SHIFT", "Új Globális Gyűlés: " + dto.name(),
                "Időpont: " + dto.startTime() + " - " + dto.endTime(), event.getOrganization().getId());

        return new ShiftDTO(saved.getId(), null, "Globális", saved.getName(), saved.getStartTime(), saved.getEndTime(), saved.getMaxVolunteers(), saved.getMaxBackupVolunteers(), saved.getType().name(), saved.getDescription(), List.of());
    }

    @Transactional
    public ShiftDTO createShift(Long workAreaId, ShiftDTO dto, String requesterEmail) {
        WorkArea workArea = null;
        if (workAreaId != null) {
            workArea = workAreaRepository.findById(workAreaId)
                    .orElseThrow(() -> new RuntimeException("Munkaterület nem található"));
            validateShiftTimes(dto.startTime(), dto.endTime(), workArea.getEvent());
        }

        Shift shift = Shift.builder()
                .event(workArea.getEvent())
                .workArea(workArea)
                .name(dto.name())
                .startTime(dto.startTime())
                .endTime(dto.endTime())
                .maxVolunteers(dto.maxVolunteers())
                .maxBackupVolunteers(dto.maxBackupVolunteers())
                .type(dto.type() != null ? ShiftType.valueOf(dto.type()) : ShiftType.WORK)
                .description(dto.description())
                .assignments(new ArrayList<>())
                .build();

        Shift saved = shiftRepository.save(shift);

        Long orgId = workArea != null ? workArea.getEvent().getOrganization().getId() : null;
        String areaName = workArea != null ? workArea.getName() : "Globális";

        auditLogService.logAction(requesterEmail, "CREATE_SHIFT", "Új esemény: " + areaName,
                "Időpont: " + dto.startTime() + " - " + dto.endTime() + " (Max: " + dto.maxVolunteers() + " fő, Beugró: " + dto.maxBackupVolunteers() + ")", orgId);

        return new ShiftDTO(saved.getId(), workAreaId, areaName, saved.getName(), saved.getStartTime(), saved.getEndTime(), saved.getMaxVolunteers(), saved.getMaxBackupVolunteers(), saved.getType().name(), saved.getDescription(), List.of());
    }

    @Transactional
    public ShiftDTO createPersonalShift(ShiftDTO dto, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található!"));

        Shift shift = Shift.builder()
                .name(null)
                .description(dto.description())
                .startTime(dto.startTime())
                .endTime(dto.endTime())
                .maxVolunteers(1)
                .maxBackupVolunteers(0)
                .type(ShiftType.PERSONAL)
                .assignments(new ArrayList<>())
                .build();

        Shift savedShift = shiftRepository.save(shift);

        ShiftAssignment assignment = ShiftAssignment.builder()
                .shift(savedShift)
                .userId(user.getId())
                .status(AssignmentStatus.CONFIRMED)
                .build();

        shiftAssignmentRepository.save(assignment);
        savedShift.getAssignments().add(assignment);

        auditLogService.logAction(userEmail, "CREATE_PERSONAL_SHIFT", "Személyes elfoglaltság rögzítve",
                "Megnevezés: " + dto.description() + " | Idő: " + dto.startTime(), null);

        return new ShiftDTO(savedShift.getId(), null, "Személyes elfoglaltság", savedShift.getName(), savedShift.getStartTime(), savedShift.getEndTime(), savedShift.getMaxVolunteers(), savedShift.getMaxBackupVolunteers(), savedShift.getType().name(), savedShift.getDescription(), List.of());
    }

    @Transactional
    public ShiftDTO updateShift(Long shiftId, ShiftDTO dto, String requesterEmail) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new RuntimeException("Műszak nem található"));

        if (shift.getWorkArea() != null) {
            validateShiftTimes(dto.startTime(), dto.endTime(), shift.getWorkArea().getEvent());
        }

        String oldStats = "Idő: " + shift.getStartTime() + " - " + shift.getEndTime() + " (Max: " + shift.getMaxVolunteers() + ")";

        shift.setName(dto.name());
        shift.setStartTime(dto.startTime());
        shift.setEndTime(dto.endTime());
        shift.setMaxVolunteers(dto.maxVolunteers());
        shift.setMaxBackupVolunteers(dto.maxBackupVolunteers());

        if (dto.type() != null) shift.setType(ShiftType.valueOf(dto.type()));
        if (dto.description() != null) shift.setDescription(dto.description());

        Shift updated = shiftRepository.save(shift);

        Long orgId = updated.getEvent() != null ? updated.getEvent().getOrganization().getId() : null;
        String areaName = updated.getWorkArea() != null ? updated.getWorkArea().getName() : "Globális Gyűlés";

        auditLogService.logAction(requesterEmail, "UPDATE_SHIFT", "Műszak/Gyűlés módosítva: " + areaName,
                "Régi: " + oldStats + " -> Új: Idő: " + dto.startTime() + " - " + dto.endTime() + " (Max: " + dto.maxVolunteers() + ", Beugró: " + dto.maxBackupVolunteers() + ")", orgId);

        return new ShiftDTO(updated.getId(), updated.getWorkArea() != null ? updated.getWorkArea().getId() : null, areaName, updated.getName(), updated.getStartTime(), updated.getEndTime(), updated.getMaxVolunteers(), updated.getMaxBackupVolunteers(), updated.getType().name(), updated.getDescription(), List.of());
    }

    @Transactional
    public void deleteShift(Long shiftId, String message, String requesterEmail) {
        Shift shift = shiftRepository.findById(shiftId).orElseThrow(() -> new RuntimeException("Műszak nem található"));

        Long orgId = shift.getEvent() != null ? shift.getEvent().getOrganization().getId() : null;

        if (shift.getType() == ShiftType.PERSONAL) {
            String targetUser = "Ismeretlen";
            if (!shift.getAssignments().isEmpty()) {
                User u = userRepository.findById(shift.getAssignments().get(0).getUserId()).orElse(null);
                if (u != null) targetUser = u.getName();
            }
            auditLogService.logAction(requesterEmail, "DELETE_PERSONAL_SHIFT", "Szervező törölte egy önkéntes személyes eseményét: " + targetUser, "Szervezői indoklás: " + message, orgId);
        } else {
            String areaName = shift.getWorkArea() != null ? shift.getWorkArea().getName() : "Globális Gyűlés";
            auditLogService.logAction(requesterEmail, "DELETE_SHIFT", "Műszak/Gyűlés törölve: " + areaName, "Az idősáv törlésre került.", orgId);
        }

        shiftRepository.delete(shift);
    }

    @Transactional
    public void deletePersonalShift(Long shiftId, String userEmail) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new RuntimeException("Esemény nem található!"));

        if (shift.getType() != ShiftType.PERSONAL) {
            throw new RuntimeException("Csak személyes elfoglaltságot törölhetsz így!");
        }

        User user = userRepository.findByEmail(userEmail).orElseThrow();

        boolean isOwner = shift.getAssignments().stream()
                .anyMatch(a -> a.getUserId().equals(user.getId()));

        if (!isOwner) {
            throw new RuntimeException("Nincs jogosultságod ezt törölni!");
        }

        auditLogService.logAction(userEmail, "DELETE_PERSONAL_SHIFT", "Személyes elfoglaltság törölve az önkéntes által", "Megnevezés: " + shift.getDescription(), null);

        shiftRepository.delete(shift);
    }

    private void validateShiftTimes(LocalDateTime startTime, LocalDateTime endTime, Event event) {
        if (startTime == null || endTime == null) {
            throw new RuntimeException("Kérlek, adj meg egy érvényes kezdési és befejezési időpontot a műszakhoz!");
        }
        if (!startTime.isBefore(endTime)) {
            throw new RuntimeException("Érvénytelen időpontok: A műszak nem érhet véget hamarabb, mint ahogy elkezdődik!");
        }
        if (startTime.isBefore(event.getStartTime()) || endTime.isAfter(event.getEndTime())) {
            throw new RuntimeException("A műszak időpontja kilóg az esemény idejéből!");
        }
    }

    private boolean isNightShift(LocalDateTime start, LocalDateTime end) {
        LocalDateTime current = start;
        while (current.isBefore(end)) {
            int hour = current.getHour();
            if (hour >= 22 || hour < 6) return true;
            current = current.plusMinutes(30);
        }
        return false;
    }
}