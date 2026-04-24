package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.AnnouncementDTO;
import com.example.volunteermanagement.service.AnnouncementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/announcements")
@RequiredArgsConstructor
public class AnnouncementController {

    private final AnnouncementService announcementService;

    @GetMapping("/feed")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<AnnouncementDTO>> getMyFeed(Principal principal) {
        return ResponseEntity.ok(announcementService.getDashboardFeed(principal.getName()));
    }

    // Lékéri a felhasználó számára engedélyezett posztolási célpontokat!
    @GetMapping("/allowed-targets")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<Map<String, String>>> getAllowedTargets(Principal principal) {
        return ResponseEntity.ok(announcementService.getAllowedPostTargets(principal.getName()));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AnnouncementDTO> createAnnouncement(
            @RequestParam("title") String title,
            @RequestParam("content") String content,
            @RequestParam("targetType") String targetType,
            @RequestParam(value = "targetId", required = false) Long targetId,
            @RequestParam(value = "images", required = false) List<MultipartFile> images,
            Principal principal) {

        return ResponseEntity.ok(announcementService.createAnnouncement(title, content, targetType, targetId, images, principal.getName()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> deleteAnnouncement(@PathVariable Long id) {
        announcementService.deleteAnnouncement(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/comments")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AnnouncementDTO> addComment(@PathVariable Long id, @RequestBody Map<String, String> payload, Principal principal) {
        return ResponseEntity.ok(announcementService.addComment(id, payload.get("content"), principal.getName()));
    }

    @PostMapping("/{id}/reactions")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AnnouncementDTO> toggleReaction(@PathVariable Long id, @RequestBody Map<String, String> payload, Principal principal) {
        return ResponseEntity.ok(announcementService.toggleReaction(id, payload.get("type"), principal.getName()));
    }

    // JAVÍTOTT RÉSZ: Principal használata és @PreAuthorize hozzáadása
    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AnnouncementDTO> updateAnnouncement(
            @PathVariable Long id,
            @RequestParam("title") String title,
            @RequestParam("content") String content,
            @RequestParam(value = "keptImages", required = false) List<String> keptImages,
            @RequestParam(value = "images", required = false) List<MultipartFile> images,
            Principal principal) {
        return ResponseEntity.ok(announcementService.updateAnnouncement(id, title, content, keptImages, images, principal.getName()));
    }

    // Komment szerkesztése
    @PutMapping("/comments/{commentId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AnnouncementDTO> updateComment(@PathVariable Long commentId, @RequestBody Map<String, String> payload, Principal principal) {
        return ResponseEntity.ok(announcementService.updateComment(commentId, payload.get("content"), principal.getName()));
    }

    // Komment törlése
    @DeleteMapping("/comments/{commentId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AnnouncementDTO> deleteComment(@PathVariable Long commentId, Principal principal) {
        return ResponseEntity.ok(announcementService.deleteComment(commentId, principal.getName()));
    }

    // Kommentre reagálás
    @PostMapping("/comments/{commentId}/reactions")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AnnouncementDTO> toggleCommentReaction(@PathVariable Long commentId, @RequestBody Map<String, String> payload, Principal principal) {
        return ResponseEntity.ok(announcementService.toggleCommentReaction(commentId, payload.get("type"), principal.getName()));
    }

    // Válasz egy kommentre (Reply)
    @PostMapping("/{announcementId}/comments/{parentCommentId}/reply")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AnnouncementDTO> replyToComment(@PathVariable Long announcementId, @PathVariable Long parentCommentId, @RequestBody Map<String, String> payload, Principal principal) {
        return ResponseEntity.ok(announcementService.addReplyToComment(announcementId, parentCommentId, payload.get("content"), principal.getName()));
    }
}