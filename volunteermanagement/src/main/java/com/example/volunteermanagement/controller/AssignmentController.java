package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.model.Assignment;
import com.example.volunteermanagement.service.AssignmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/assignments")
@RequiredArgsConstructor
public class AssignmentController {

    private final AssignmentService assignmentService;

    // Jelentkezem erre a shift-re!
    @PostMapping("/apply/{shiftId}")
    public ResponseEntity<String> applyForShift(
            @PathVariable Long shiftId,
            Principal principal
    ) {
        assignmentService.applyForShift(principal.getName(), shiftId);
        return ResponseEntity.ok("Sikeres jelentkezés!");
    }

    // Hova jelentkeztem eddig?
    @GetMapping("/my")
    public ResponseEntity<List<Assignment>> getMyAssignments(Principal principal) {
        return ResponseEntity.ok(assignmentService.getMyAssignments(principal.getName()));
    }
}