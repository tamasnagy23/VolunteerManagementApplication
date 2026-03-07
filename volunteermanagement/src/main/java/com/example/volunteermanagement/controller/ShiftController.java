package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.AssignShiftRequest;
import com.example.volunteermanagement.dto.ShiftDTO;
import com.example.volunteermanagement.service.ShiftService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal; // <-- Importáljuk

@RestController
@RequestMapping("/api/shifts")
@RequiredArgsConstructor
public class ShiftController {

    private final ShiftService shiftService;

    @PostMapping("/{shiftId}/assign")
    public ResponseEntity<String> assignUsersToShift(
            @PathVariable Long shiftId,
            @RequestBody AssignShiftRequest request,
            Principal principal) { // <-- Bejelentkezett user elkérése

        shiftService.assignUsersToShift(shiftId, request, principal.getName());
        return ResponseEntity.ok("Sikeres beosztás!");
    }

    @DeleteMapping("/{shiftId}/remove/{applicationId}")
    public ResponseEntity<String> removeUserFromShift(
            @PathVariable Long shiftId,
            @PathVariable Long applicationId,
            Principal principal) { // <-- Bejelentkezett user elkérése

        shiftService.removeUserFromShift(shiftId, applicationId, principal.getName());
        return ResponseEntity.ok("Sikeres eltávolítás!");
    }

    @PostMapping("/work-area/{workAreaId}")
    public ResponseEntity<ShiftDTO> createShift(
            @PathVariable Long workAreaId,
            @RequestBody ShiftDTO dto,
            Principal principal) {
        return ResponseEntity.ok(shiftService.createShift(workAreaId, dto, principal.getName()));
    }

    @DeleteMapping("/{shiftId}")
    public ResponseEntity<Void> deleteShift(@PathVariable Long shiftId, Principal principal) {
        shiftService.deleteShift(shiftId, principal.getName());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{shiftId}")
    public ResponseEntity<ShiftDTO> updateShift(
            @PathVariable Long shiftId,
            @RequestBody ShiftDTO dto,
            Principal principal) {
        return ResponseEntity.ok(shiftService.updateShift(shiftId, dto, principal.getName()));
    }

    // --- ÚJ: Önkéntes visszajelzése (Elfogadás vagy Módosítás kérése) ---
    @PutMapping("/assignments/{assignmentId}/status")
    public ResponseEntity<Void> updateAssignmentStatus(
            @PathVariable Long assignmentId,
            @RequestBody com.example.volunteermanagement.dto.UpdateAssignmentStatusRequest request,
            Principal principal) {

        shiftService.updateAssignmentStatus(assignmentId, request, principal.getName());
        return ResponseEntity.ok().build();
    }
}