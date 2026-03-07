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
    private final ShiftAssignmentRepository shiftAssignmentRepository; // ÚJ!

    @Transactional(readOnly = true)
    public List<ShiftDTO> getShiftsByEvent(Long eventId) {
        List<Shift> shifts = shiftRepository.findByEventId(eventId);

        return shifts.stream().map(shift -> {
            List<AssignedUserDTO> assignedUsers = shift.getAssignments().stream() // JAVÍTVA
                    .map(assignment -> {
                        User user = assignment.getUser();
                        Long appId = applicationRepository.findByUserAndEventId(user, eventId).stream()
                                .filter(app -> app.getAssignedWorkArea() != null &&
                                        app.getAssignedWorkArea().getId().equals(shift.getWorkArea().getId()))
                                .map(Application::getId)
                                .findFirst()
                                .orElse(null);

                        return new AssignedUserDTO(
                                appId,
                                user.getId(),
                                user.getName(),
                                user.getEmail()
                        );
                    })
                    .collect(Collectors.toList());

            return new ShiftDTO(
                    shift.getId(),
                    shift.getWorkArea().getId(),
                    shift.getWorkArea().getName(),
                    shift.getName(),
                    shift.getStartTime(),
                    shift.getEndTime(),
                    shift.getMaxVolunteers(),
                    assignedUsers
            );
        }).collect(Collectors.toList());
    }

    // --- ÚJ METÓDUS: ÖNKÉNTES SAJÁT NAPTÁRÁHOZ ---
    @Transactional(readOnly = true)
    public List<MyShiftDTO> getMyShifts(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("Felhasználó nem található!"));

        List<ShiftAssignment> assignments = shiftAssignmentRepository.findByUser(user);

        return assignments.stream().map(assignment -> {
            Shift shift = assignment.getShift();
            Event event = shift.getWorkArea().getEvent();

            // Munkatársak kigyűjtése (kivéve saját maga)
            List<String> coWorkers = shift.getAssignments().stream()
                    .filter(a -> !a.getUser().getId().equals(user.getId()))
                    .map(a -> a.getUser().getName())
                    .collect(Collectors.toList());

            return new MyShiftDTO(
                    assignment.getId(),
                    shift.getId(),
                    event.getTitle(),
                    shift.getWorkArea().getName(),
                    shift.getStartTime().toString(),
                    shift.getEndTime().toString(),
                    assignment.getStatus().name(),
                    assignment.getMessage(),
                    coWorkers
            );
        }).collect(Collectors.toList());
    }

    // --- ÚJ METÓDUS: STÁTUSZ FRISSÍTÉSE (ELFOGADÁS / MÓDOSÍTÁS) ---
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

        auditLogService.logAction(userEmail, "SHIFT_STATUS_UPDATE",
                "Beosztás státusza módosítva: " + request.status(),
                "Üzenet: " + request.message(),
                assignment.getShift().getWorkArea().getEvent().getOrganization().getId());
    }

    @Transactional
    public void assignUsersToShift(Long shiftId, AssignShiftRequest request, String requesterEmail) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new RuntimeException("Műszak nem található!"));

        List<Application> applications = applicationRepository.findAllById(request.applicationIds());

        boolean allApproved = applications.stream()
                .allMatch(app -> app.getStatus() == ApplicationStatus.APPROVED);
        if (!allApproved) {
            throw new RuntimeException("Csak elfogadott jelentkezőket oszthatsz be!");
        }

        if (shift.getAssignments().size() + applications.size() > shift.getMaxVolunteers()) { // JAVÍTVA
            throw new RuntimeException("A műszak betelt!");
        }

        List<User> usersToAdd = applications.stream()
                .map(Application::getUser)
                .collect(Collectors.toList());

        boolean isNight = isNightShift(shift.getStartTime(), shift.getEndTime());

        for (User user : usersToAdd) {
            // Időpont ütközés vizsgálata az új entitáson keresztül
            List<ShiftAssignment> userAssignments = shiftAssignmentRepository.findByUser(user);

            for (ShiftAssignment assignment : userAssignments) {
                Shift existingShift = assignment.getShift();
                boolean isOverlapping = existingShift.getStartTime().isBefore(shift.getEndTime()) &&
                        existingShift.getEndTime().isAfter(shift.getStartTime());

                if (isOverlapping) {
                    throw new RuntimeException("Időpont ütközés! " + user.getName() +
                            " már be van osztva máshova ebben az időszakban: " +
                            existingShift.getWorkArea().getName() +
                            " (" + existingShift.getStartTime().toLocalTime() + " - " +
                            existingShift.getEndTime().toLocalTime() + ")");
                }
            }

            if (isNight) {
                if (user.getDateOfBirth() == null) {
                    throw new RuntimeException("Munkajogi hiba: " + user.getName() +
                            " profiljában nincs megadva születési dátum, így biztonsági okokból nem osztható be olyan műszakba, ami érinti az éjszakát (22:00-06:00)!");
                }

                LocalDate shiftDate = shift.getStartTime().toLocalDate();
                int ageAtShift = Period.between(user.getDateOfBirth(), shiftDate).getYears();

                if (ageAtShift < 18) {
                    throw new RuntimeException("Munkajogi hiba: Kiskorú önkéntes (" + user.getName() +
                            ", aki csak " + ageAtShift + " éves lesz a beosztás napján) nem osztható be olyan műszakba, ami érinti az éjszakát (22:00 - 06:00)!");
                }
            }

            // --- JAVÍTVA: Új Assignment létrehozása ---
            ShiftAssignment newAssignment = ShiftAssignment.builder()
                    .shift(shift)
                    .user(user)
                    .status(AssignmentStatus.PENDING) // Alapból függőben van
                    .build();

            shift.getAssignments().add(newAssignment);
        }

        shiftRepository.save(shift);

        String userNames = usersToAdd.stream().map(User::getName).collect(Collectors.joining(", "));
        Long orgId = shift.getWorkArea().getEvent().getOrganization().getId();

        auditLogService.logAction(requesterEmail, "ASSIGN_SHIFT", "Műszak beosztás: " + shift.getWorkArea().getName(),
                usersToAdd.size() + " fő beosztva: " + userNames, orgId);
    }

    @Transactional
    public void removeUserFromShift(Long shiftId, Long applicationId, String requesterEmail) {
        Shift shift = shiftRepository.findById(shiftId).orElseThrow(() -> new RuntimeException("Műszak nem található!"));
        Application application = applicationRepository.findById(applicationId).orElseThrow(() -> new RuntimeException("Jelentkezés nem található!"));

        // Kikeressük és töröljük a kapcsolótáblából
        ShiftAssignment assignment = shiftAssignmentRepository.findByShiftIdAndUserId(shiftId, application.getUser().getId())
                .orElseThrow(() -> new RuntimeException("Ez az önkéntes nincs beosztva ebbe a műszakba!"));

        shift.getAssignments().remove(assignment);
        shiftAssignmentRepository.delete(assignment);

        shiftRepository.save(shift);

        auditLogService.logAction(requesterEmail, "REMOVE_FROM_SHIFT", "Műszakból törölve: " + shift.getWorkArea().getName(),
                "Eltávolított önkéntes: " + application.getUser().getName(), shift.getWorkArea().getEvent().getOrganization().getId());
    }

    @Transactional
    public ShiftDTO createShift(Long workAreaId, ShiftDTO dto, String requesterEmail) {
        WorkArea workArea = workAreaRepository.findById(workAreaId)
                .orElseThrow(() -> new RuntimeException("Munkaterület nem található"));

        validateShiftTimes(dto.startTime(), dto.endTime(), workArea.getEvent());

        Shift shift = Shift.builder()
                .workArea(workArea)
                .name(dto.name())
                .startTime(dto.startTime())
                .endTime(dto.endTime())
                .maxVolunteers(dto.maxVolunteers())
                .assignments(new ArrayList<>()) // JAVÍTVA
                .build();

        Shift saved = shiftRepository.save(shift);

        auditLogService.logAction(requesterEmail, "CREATE_SHIFT", "Új műszak: " + workArea.getName(),
                "Időpont: " + dto.startTime() + " - " + dto.endTime() + " (Max: " + dto.maxVolunteers() + " fő)", workArea.getEvent().getOrganization().getId());

        return new ShiftDTO(saved.getId(), workAreaId, workArea.getName(), saved.getName(), saved.getStartTime(), saved.getEndTime(), saved.getMaxVolunteers(), List.of());
    }

    @Transactional
    public ShiftDTO updateShift(Long shiftId, ShiftDTO dto, String requesterEmail) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new RuntimeException("Műszak nem található"));

        validateShiftTimes(dto.startTime(), dto.endTime(), shift.getWorkArea().getEvent());

        String oldStats = "Idő: " + shift.getStartTime() + " - " + shift.getEndTime() + " (Max: " + shift.getMaxVolunteers() + ")";

        shift.setName(dto.name());
        shift.setStartTime(dto.startTime());
        shift.setEndTime(dto.endTime());
        shift.setMaxVolunteers(dto.maxVolunteers());

        Shift updated = shiftRepository.save(shift);

        auditLogService.logAction(requesterEmail, "UPDATE_SHIFT", "Műszak módosítva: " + shift.getWorkArea().getName(),
                "Régi: " + oldStats + " -> Új: Idő: " + dto.startTime() + " - " + dto.endTime() + " (Max: " + dto.maxVolunteers() + ")", shift.getWorkArea().getEvent().getOrganization().getId());

        return new ShiftDTO(updated.getId(), shift.getWorkArea().getId(), shift.getWorkArea().getName(), updated.getName(), updated.getStartTime(), updated.getEndTime(), updated.getMaxVolunteers(), List.of());
    }

    @Transactional
    public void deleteShift(Long shiftId, String requesterEmail) {
        Shift shift = shiftRepository.findById(shiftId).orElseThrow(() -> new RuntimeException("Műszak nem található"));
        Long orgId = shift.getWorkArea().getEvent().getOrganization().getId();
        String areaName = shift.getWorkArea().getName();

        shiftRepository.delete(shift);
        auditLogService.logAction(requesterEmail, "DELETE_SHIFT", "Műszak törölve: " + areaName, "Az idősáv és minden hozzárendelt beosztás törlésre került.", orgId);
    }

    private void validateShiftTimes(LocalDateTime startTime, LocalDateTime endTime, Event event) {
        if (startTime == null || endTime == null) {
            throw new RuntimeException("Kérlek, adj meg egy érvényes kezdési és befejezési időpontot a műszakhoz!");
        }

        if (!startTime.isBefore(endTime)) {
            throw new RuntimeException("Érvénytelen időpontok: A műszak nem érhet véget hamarabb (vagy ugyanakkor), mint ahogy elkezdődik!");
        }

        if (startTime.isBefore(event.getStartTime()) || endTime.isAfter(event.getEndTime())) {
            throw new RuntimeException("A műszak időpontja kilóg az esemény idejéből!\nAz esemény tartama: "
                    + event.getStartTime().toLocalDate() + " " + event.getStartTime().toLocalTime() + " - "
                    + event.getEndTime().toLocalDate() + " " + event.getEndTime().toLocalTime());
        }
    }

    private boolean isNightShift(LocalDateTime start, LocalDateTime end) {
        LocalDateTime current = start;

        while (current.isBefore(end)) {
            int hour = current.getHour();
            if (hour >= 22 || hour < 6) {
                return true;
            }
            current = current.plusMinutes(30);
        }

        return false;
    }
}