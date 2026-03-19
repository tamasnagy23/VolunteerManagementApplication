package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.AssignShiftRequest;
import com.example.volunteermanagement.dto.ShiftDTO;
import com.example.volunteermanagement.service.ShiftService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/api/shifts")
@RequiredArgsConstructor
public class ShiftController {

    private final ShiftService shiftService;

    // A beosztáshoz a szolgáltatáson belül vagy külön paraméterből kell ellenőrizni,
    // de hagyhatjuk isAuthenticated-en, és a Service eldönti (vagy rátehetjük a zárra, ha a shiftId-ből kinyerjük).
    @PostMapping("/{shiftId}/assign")
    @PreAuthorize("@eventSecurity.canManageShift(authentication.name, #shiftId)")
    public ResponseEntity<String> assignUsersToShift(
            @PathVariable Long shiftId,
            @RequestBody AssignShiftRequest request,
            Principal principal) {

        shiftService.assignUsersToShift(shiftId, request, principal.getName());
        return ResponseEntity.ok("Sikeres beosztás!");
    }

    @DeleteMapping("/{shiftId}/remove/{applicationId}")
    @PreAuthorize("@eventSecurity.canManageShift(authentication.name, #shiftId)")
    public ResponseEntity<String> removeUserFromShift(
            @PathVariable Long shiftId,
            @PathVariable Long applicationId,
            Principal principal) {

        shiftService.removeUserFromShift(shiftId, applicationId, principal.getName());
        return ResponseEntity.ok("Sikeres eltávolítás!");
    }

    // JAVÍTVA: Műszakot CSAK arra a területre hozhat létre, aminek a Koordinátora!
    @PostMapping("/work-area/{workAreaId}")
    @PreAuthorize("@eventSecurity.canManageWorkArea(authentication.name, #workAreaId)")
    public ResponseEntity<ShiftDTO> createShift(
            @PathVariable Long workAreaId,
            @RequestBody ShiftDTO dto,
            Principal principal) {
        return ResponseEntity.ok(shiftService.createShift(workAreaId, dto, principal.getName()));
    }

    // JAVÍTVA: Globális gyűlést CSAK eseményszintű joggal lehet!
    @PostMapping("/event/{eventId}/global")
    @PreAuthorize("@eventSecurity.hasPermission(authentication.name, #eventId, 'MANAGE_SHIFTS')")
    public ResponseEntity<ShiftDTO> createGlobalShift(
            @PathVariable Long eventId,
            @RequestBody ShiftDTO dto,
            Principal principal) {
        return ResponseEntity.ok(shiftService.createGlobalShift(eventId, dto, principal.getName()));
    }

    // Személyeset bárki készíthet magának
    @PostMapping("/personal")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ShiftDTO> createPersonalShift(@RequestBody ShiftDTO dto, Principal principal) {
        return ResponseEntity.ok(shiftService.createPersonalShift(dto, principal.getName()));
    }

    @DeleteMapping("/personal/{shiftId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> deletePersonalShift(@PathVariable Long shiftId, Principal principal) {
        shiftService.deletePersonalShift(shiftId, principal.getName());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{shiftId}")
    @PreAuthorize("@eventSecurity.canManageShift(authentication.name, #shiftId)")
    public ResponseEntity<Void> deleteShift(
            @PathVariable Long shiftId,
            @RequestParam(required = false) String message,
            Principal principal) {
        shiftService.deleteShift(shiftId, message, principal.getName());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{shiftId}")
    @PreAuthorize("@eventSecurity.canManageShift(authentication.name, #shiftId)")
    public ResponseEntity<ShiftDTO> updateShift(
            @PathVariable Long shiftId,
            @RequestBody ShiftDTO dto,
            Principal principal) {
        return ResponseEntity.ok(shiftService.updateShift(shiftId, dto, principal.getName()));
    }

    @PutMapping("/assignments/{assignmentId}/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> updateAssignmentStatus(
            @PathVariable Long assignmentId,
            @RequestBody com.example.volunteermanagement.dto.UpdateAssignmentStatusRequest request,
            Principal principal) {

        shiftService.updateAssignmentStatus(assignmentId, request, principal.getName());
        return ResponseEntity.ok().build();
    }
}