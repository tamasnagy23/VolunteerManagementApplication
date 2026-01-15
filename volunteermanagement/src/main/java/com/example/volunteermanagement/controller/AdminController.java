package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.ChangeStatusRequest;
import com.example.volunteermanagement.model.Assignment;
import com.example.volunteermanagement.service.AssignmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')") // Ez a védelem kulcsa!
public class AdminController {

    private final AssignmentService assignmentService;

    // Státusz váltás (Elfogad/Elutasít)
    @PutMapping("/assignments/{id}/status")
    public ResponseEntity<Assignment> updateAssignmentStatus(
            @PathVariable Long id,
            @Valid @RequestBody ChangeStatusRequest request
    ) {
        return ResponseEntity.ok(assignmentService.changeStatus(id, request.status()));
    }

    // Kik jelentkeztek erre a műszakra?
    @GetMapping("/shifts/{shiftId}/assignments")
    public ResponseEntity<List<Assignment>> getShiftAssignments(@PathVariable Long shiftId) {
        return ResponseEntity.ok(assignmentService.getAssignmentsForShift(shiftId));
    }
}