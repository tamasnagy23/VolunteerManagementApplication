package com.example.volunteermanagement.service;

import com.example.volunteermanagement.dto.AssignShiftRequest;
import com.example.volunteermanagement.dto.AssignedUserDTO;
import com.example.volunteermanagement.dto.ShiftDTO;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.ApplicationRepository;
import com.example.volunteermanagement.repository.ShiftRepository;
import com.example.volunteermanagement.repository.WorkAreaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional(readOnly = true)
    public List<ShiftDTO> getShiftsByEvent(Long eventId) {
        List<Shift> shifts = shiftRepository.findByEventId(eventId);

        return shifts.stream().map(shift -> {
            List<AssignedUserDTO> assignedUsers = shift.getVolunteers().stream()
                    .map(user -> {
                        // JAVÍTÁS: Listát kapunk, kikeressük belőle azt, amelyik ehhez a WorkArea-hoz tartozik!
                        Long appId = applicationRepository.findByUserAndEventId(user, eventId).stream()
                                .filter(app -> app.getAssignedWorkArea() != null &&
                                        app.getAssignedWorkArea().getId().equals(shift.getWorkArea().getId()))
                                .map(Application::getId)
                                .findFirst()
                                .orElse(null); // Ha valamiért nincs, null lesz, de nem fagy le

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
                    shift.getStartTime(),
                    shift.getEndTime(),
                    shift.getMaxVolunteers(),
                    assignedUsers
            );
        }).collect(Collectors.toList());
    }

    // BEOSZTÁS + NAPLÓZÁS + ÜTKÖZÉS VIZSGÁLAT
    @Transactional
    public void assignUsersToShift(Long shiftId, AssignShiftRequest request, String requesterEmail) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new RuntimeException("Műszak nem található!"));

        // Lekérjük a jelentkezéseket az ID-k alapján
        List<Application> applications = applicationRepository.findAllById(request.applicationIds());

        // Ellenőrzések: csak elfogadott jelentkezők
        boolean allApproved = applications.stream()
                .allMatch(app -> app.getStatus() == ApplicationStatus.APPROVED);
        if (!allApproved) {
            throw new RuntimeException("Csak elfogadott jelentkezőket oszthatsz be!");
        }

        // Kapacitás ellenőrzése
        if (shift.getVolunteers().size() + applications.size() > shift.getMaxVolunteers()) {
            throw new RuntimeException("A műszak betelt!");
        }

        // --- ÁTALAKÍTÁS: Application -> User ---
        List<User> usersToAdd = applications.stream()
                .map(Application::getUser)
                .collect(Collectors.toList());

        // --- ÚJ: IDŐPONT ÜTKÖZÉS (ÁTFEDÉS) VIZSGÁLATA ---
        for (User user : usersToAdd) {
            for (Shift existingShift : user.getShifts()) {
                // Megnézzük, hogy az új műszak ideje belelóg-e az önkéntes egy már meglévő műszakjába
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
        }

        // Ha idáig eljutott a kód, nincs ütközés, be lehet osztani őket!
        shift.getVolunteers().addAll(usersToAdd);
        shiftRepository.save(shift);

        // NAPLÓZÁS
        String userNames = usersToAdd.stream().map(User::getName).collect(Collectors.joining(", "));
        Long orgId = shift.getWorkArea().getEvent().getOrganization().getId();

        auditLogService.logAction(
                requesterEmail,
                "ASSIGN_SHIFT",
                "Műszak beosztás: " + shift.getWorkArea().getName(),
                usersToAdd.size() + " fő beosztva: " + userNames,
                orgId
        );
    }

    @Transactional
    public void removeUserFromShift(Long shiftId, Long applicationId, String requesterEmail) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new RuntimeException("Műszak nem található!"));

        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new RuntimeException("Jelentkezés nem található!"));

        // Eltávolítjuk a felhasználót a műszak volunteers listájából
        shift.getVolunteers().remove(application.getUser());
        shiftRepository.save(shift);

        // NAPLÓZÁS
        Long orgId = shift.getWorkArea().getEvent().getOrganization().getId();

        auditLogService.logAction(
                requesterEmail,
                "REMOVE_FROM_SHIFT",
                "Műszakból törölve: " + shift.getWorkArea().getName(),
                "Eltávolított önkéntes: " + application.getUser().getName(),
                orgId
        );
    }

    @Transactional
    public ShiftDTO createShift(Long workAreaId, ShiftDTO dto, String requesterEmail) {
        WorkArea workArea = workAreaRepository.findById(workAreaId)
                .orElseThrow(() -> new RuntimeException("Munkaterület nem található"));

        Shift shift = Shift.builder()
                .workArea(workArea)
                .startTime(dto.startTime())
                .endTime(dto.endTime())
                .maxVolunteers(dto.maxVolunteers())
                .volunteers(new ArrayList<>())
                .build();

        Shift saved = shiftRepository.save(shift);

        // NAPLÓZÁS
        auditLogService.logAction(
                requesterEmail,
                "CREATE_SHIFT",
                "Új műszak: " + workArea.getName(),
                "Időpont: " + dto.startTime() + " - " + dto.endTime() + " (Max: " + dto.maxVolunteers() + " fő)",
                workArea.getEvent().getOrganization().getId()
        );

        return new ShiftDTO(saved.getId(), workAreaId, workArea.getName(),
                saved.getStartTime(), saved.getEndTime(), saved.getMaxVolunteers(), List.of());
    }

    @Transactional
    public void deleteShift(Long shiftId, String requesterEmail) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new RuntimeException("Műszak nem található"));

        Long orgId = shift.getWorkArea().getEvent().getOrganization().getId();
        String areaName = shift.getWorkArea().getName();

        shiftRepository.delete(shift);

        // NAPLÓZÁS
        auditLogService.logAction(
                requesterEmail,
                "DELETE_SHIFT",
                "Műszak törölve: " + areaName,
                "Az idősáv és minden hozzárendelt beosztás törlésre került.",
                orgId
        );
    }

    @Transactional
    public ShiftDTO updateShift(Long shiftId, ShiftDTO dto, String requesterEmail) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new RuntimeException("Műszak nem található"));

        // Elmentjük a régi értékeket a naplózáshoz (opcionális, de profi)
        String oldStats = "Idő: " + shift.getStartTime() + " - " + shift.getEndTime() + " (Max: " + shift.getMaxVolunteers() + ")";

        shift.setStartTime(dto.startTime());
        shift.setEndTime(dto.endTime());
        shift.setMaxVolunteers(dto.maxVolunteers());

        Shift updated = shiftRepository.save(shift);

        // NAPLÓZÁS
        auditLogService.logAction(
                requesterEmail,
                "UPDATE_SHIFT",
                "Műszak módosítva: " + shift.getWorkArea().getName(),
                "Régi: " + oldStats + " -> Új: Idő: " + dto.startTime() + " - " + dto.endTime() + " (Max: " + dto.maxVolunteers() + ")",
                shift.getWorkArea().getEvent().getOrganization().getId()
        );

        return new ShiftDTO(updated.getId(), shift.getWorkArea().getId(), shift.getWorkArea().getName(),
                updated.getStartTime(), updated.getEndTime(), updated.getMaxVolunteers(), List.of());
    }
}