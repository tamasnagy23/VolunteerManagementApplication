package com.example.volunteermanagement.service;

import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AssignmentService {

    private final AssignmentRepository assignmentRepository;
    private final ShiftRepository shiftRepository;
    private final VolunteerProfileRepository volunteerRepository;
    private final UserRepository userRepository;

    @Transactional
    public Assignment applyForShift(String userEmail, Long shiftId) {
        // 1. Adatok betöltése
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new UsernameNotFoundException("User nem található"));

        VolunteerProfile volunteer = volunteerRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("Kérlek előbb töltsd ki a profilodat!"));

        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new RuntimeException("Műszak nem található"));

        // 2. VALIDÁCIÓK
        if (shift.getStartTime().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Erre a műszakra már nem lehet jelentkezni (elmúlt).");
        }

        if (assignmentRepository.existsByVolunteerAndShift(volunteer, shift)) {
            throw new RuntimeException("Már jelentkeztél erre a műszakra.");
        }

        long approvedCount = assignmentRepository.countByShiftAndStatus(shift, AssignmentStatus.APPROVED);
        if (approvedCount >= shift.getMaxVolunteers()) {
            throw new RuntimeException("Sajnos ez a műszak már betelt.");
        }

        // 3. Mentés (Automatikusan APPROVED, de lehetne PENDING is)
        Assignment assignment = Assignment.builder()
                .volunteer(volunteer)
                .shift(shift)
                .assignedAt(LocalDateTime.now())
                .status(AssignmentStatus.APPROVED)
                .build();

        return assignmentRepository.save(assignment);
    }

    public List<Assignment> getMyAssignments(String userEmail) {
        User user = userRepository.findByEmail(userEmail).orElseThrow();
        // Itt nem dobunk hibát, ha nincs profil, csak üres listát adunk
        return volunteerRepository.findByUser(user)
                .map(assignmentRepository::findByVolunteer)
                .orElse(List.of());
    }

    // --- ADMIN FUNKCIÓK ---

    @Transactional
    public Assignment changeStatus(Long assignmentId, AssignmentStatus newStatus) {
        Assignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new RuntimeException("Jelentkezés nem található"));

        assignment.setStatus(newStatus);
        return assignmentRepository.save(assignment);
    }

    public List<Assignment> getAssignmentsForShift(Long shiftId) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new RuntimeException("Műszak nem található"));
        return assignmentRepository.findByShift(shift);
    }
}