package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.VolunteerProfileDTO;
import com.example.volunteermanagement.service.VolunteerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/api/volunteers")
@RequiredArgsConstructor
public class VolunteerController {

    private final VolunteerService volunteerService;

    // Ki vagyok én? (Profil lekérése token alapján)
    @GetMapping("/me")
    public ResponseEntity<VolunteerProfileDTO> getMyProfile(Principal principal) {
        return ResponseEntity.ok(volunteerService.getMyProfile(principal.getName()));
    }

    // Profil frissítése
    @PutMapping("/me")
    public ResponseEntity<VolunteerProfileDTO> updateMyProfile(
            Principal principal,
            @RequestBody VolunteerProfileDTO dto
    ) {
        return ResponseEntity.ok(volunteerService.updateMyProfile(principal.getName(), dto));
    }
}