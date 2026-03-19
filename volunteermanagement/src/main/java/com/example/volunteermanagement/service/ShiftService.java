package com.example.volunteermanagement.service;

import com.example.volunteermanagement.dto.*;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
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

    @Transactional(readOnly = true)
    public List<ShiftDTO> getShiftsByEvent(Long eventId) {
        List<Shift> allShifts = shiftRepository.findAll();

        List<Shift> shifts = allShifts.stream()
                .filter(s -> s.getType() == ShiftType.PERSONAL ||
                        (s.getWorkArea() != null && s.getWorkArea().getEvent().getId().equals(eventId)) ||
                        (s.getEvent() != null && s.getEvent().getId().equals(eventId)))
                .collect(Collectors.toList());

        return shifts.stream().map(shift -> {
            List<AssignedUserDTO> assignedUsers = shift.getAssignments().stream()
                    .map(assignment -> {
                        User user = assignment.getUser();

                        Long appId = applicationRepository.findByUserAndEventId(user, eventId).stream()
                                .filter(app -> shift.getWorkArea() == null ||
                                        (app.getAssignedWorkArea() != null && app.getAssignedWorkArea().getId().equals(shift.getWorkArea().getId())))
                                .map(Application::getId)
                                .findFirst()
                                .orElseGet(() -> applicationRepository.findByUserAndEventId(user, eventId).stream().map(Application::getId).findFirst().orElse(null));

                        return new AssignedUserDTO(
                                appId,
                                user.getId(),
                                user.getName(),
                                user.getEmail(),
                                assignment.getStatus().name(),
                                assignment.getMessage(),
                                assignment.isBackup() // ÚJ: Átküldjük a Reactnek, hogy ő beugró-e
                        );
                    })
                    .collect(Collectors.toList());

            return new ShiftDTO(
                    shift.getId(),
                    shift.getWorkArea() != null ? shift.getWorkArea().getId() : null,
                    shift.getWorkArea() != null ? shift.getWorkArea().getName() : (shift.getType() == ShiftType.PERSONAL ? "Személyes" : "Globális"),
                    shift.getName(),
                    shift.getStartTime(),
                    shift.getEndTime(),
                    shift.getMaxVolunteers(),
                    shift.getMaxBackupVolunteers(), // ÚJ
                    shift.getType() != null ? shift.getType().name() : "WORK",
                    shift.getDescription(),
                    assignedUsers
            );
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<MyShiftDTO> getMyShifts(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található!"));

        List<ShiftAssignment> assignments = shiftAssignmentRepository.findByUser(user);

        return assignments.stream().map(assignment -> {
            Shift shift = assignment.getShift();

            String eventTitle = shift.getWorkArea() != null ? shift.getWorkArea().getEvent().getTitle() : (shift.getEvent() != null ? shift.getEvent().getTitle() : "Személyes naptár");
            String workAreaName = shift.getWorkArea() != null ? shift.getWorkArea().getName() : (shift.getType() == ShiftType.MEETING ? "Globális Gyűlés" : "Személyes elfoglaltság");

            List<String> coWorkers = shift.getAssignments().stream()
                    .filter(a -> !a.getUser().getId().equals(user.getId()))
                    .map(a -> a.getUser().getName() + (a.isBackup() ? " (Beugró)" : "")) // ÚJ: Szépítés a MyShifts nézethez
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
                    coWorkers
            );
        }).collect(Collectors.toList());
    }

    @Transactional
    public void updateAssignmentStatus(Long assignmentId, UpdateAssignmentStatusRequest request, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található!"));

        ShiftAssignment assignment = shiftAssignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new RuntimeException("Beosztás nem található!"));

        if (!assignment.getUser().getId().equals(user.getId())) {
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

    // ÚJ: Átalakított beosztás metódus, ami kezeli a normál és a beugró önkénteseket is!
    @Transactional
    public void assignUsersToShift(Long shiftId, AssignShiftRequest request, String requesterEmail) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new RuntimeException("Műszak nem található!"));

        // Kinyerjük a rendes és a beugró alkalmazásokat is
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

        // Metódus egy ember ellenőrzésére és hozzáadására
        for (Application app : normalApps) {
            processAssignment(shift, app.getUser(), false, isNight);
        }
        for (Application app : backupApps) {
            processAssignment(shift, app.getUser(), true, isNight);
        }

        shiftRepository.save(shift);

        String normalNames = normalApps.stream().map(a -> a.getUser().getName()).collect(Collectors.joining(", "));
        String backupNames = backupApps.stream().map(a -> a.getUser().getName()).collect(Collectors.joining(", "));

        Long orgId = shift.getEvent() != null ? shift.getEvent().getOrganization().getId() : null;
        String areaName = shift.getWorkArea() != null ? shift.getWorkArea().getName() : "Globális Gyűlés";

        String logMessage = normalApps.size() + " normál tag: " + normalNames;
        if (!backupApps.isEmpty()) logMessage += " | " + backupApps.size() + " beugró: " + backupNames;

        auditLogService.logAction(requesterEmail, "ASSIGN_SHIFT", "Beosztás: " + areaName, logMessage, orgId);
    }

    // Segédmetódus a beosztáshoz, hogy ne ismételjük a kódot
    private void processAssignment(Shift shift, User user, boolean isBackup, boolean isNight) {
        List<ShiftAssignment> userAssignments = shiftAssignmentRepository.findByUser(user);

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
                .user(user)
                .status(AssignmentStatus.PENDING)
                .isBackup(isBackup) // ÚJ: Elmentjük, ha beugró!
                .build();

        shift.getAssignments().add(newAssignment);
    }


    @Transactional
    public void removeUserFromShift(Long shiftId, Long applicationId, String requesterEmail) {
        Shift shift = shiftRepository.findById(shiftId).orElseThrow(() -> new RuntimeException("Műszak nem található!"));
        Application application = applicationRepository.findById(applicationId).orElseThrow(() -> new RuntimeException("Jelentkezés nem található!"));

        ShiftAssignment assignment = shiftAssignmentRepository.findByShiftIdAndUserId(shiftId, application.getUser().getId())
                .orElseThrow(() -> new RuntimeException("Ez az önkéntes nincs beosztva ebbe a műszakba!"));

        shift.getAssignments().remove(assignment);
        shiftAssignmentRepository.delete(assignment);
        shiftRepository.save(shift);

        Long orgId = shift.getEvent() != null ? shift.getEvent().getOrganization().getId() : null;
        String areaName = shift.getWorkArea() != null ? shift.getWorkArea().getName() : "Globális Gyűlés";

        auditLogService.logAction(requesterEmail, "REMOVE_FROM_SHIFT", "Törlés innen: " + areaName,
                "Eltávolított önkéntes: " + application.getUser().getName(), orgId);
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
                .maxBackupVolunteers(0) // Globális gyűlésnél nem értelmezzük
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
                .maxBackupVolunteers(dto.maxBackupVolunteers()) // ÚJ
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
                .user(user)
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
        shift.setMaxBackupVolunteers(dto.maxBackupVolunteers()); // ÚJ

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
            String targetUser = shift.getAssignments().isEmpty() ? "Ismeretlen" : shift.getAssignments().get(0).getUser().getName();
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

        boolean isOwner = shift.getAssignments().stream()
                .anyMatch(a -> a.getUser().getEmail().equals(userEmail));

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