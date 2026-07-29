package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.model.Document;
import com.example.volunteermanagement.service.DocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;

    // 1. Dokumentum feltöltése
    @PostMapping("/upload")
    public ResponseEntity<Document> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam("documentType") String documentType,
            @RequestParam("tenantId") String tenantId,
            @RequestParam("eventId") Long eventId, // <--- ÚJ PARAMÉTER
            @RequestParam(value = "userId", required = false) Long userId) {

        Document savedDocument = documentService.uploadDocument(file, documentType, tenantId, eventId, userId);
        return ResponseEntity.ok(savedDocument);
    }

    // 2. Egy adott ESEMÉNY összes dokumentumának lekérése (Szervezői nézet)
    @GetMapping("/event/{eventId}")
    public ResponseEntity<List<Document>> getDocumentsByEvent(@PathVariable Long eventId) {
        List<Document> documents = documentService.getDocumentsByEvent(eventId);
        return ResponseEntity.ok(documents);
    }

    // 3. Egy adott önkéntes dokumentumai az eseményen (Önkéntes profil)
    @GetMapping("/event/{eventId}/user/{userId}")
    public ResponseEntity<List<Document>> getVolunteerDocuments(
            @PathVariable Long eventId,
            @PathVariable Long userId) {
        List<Document> documents = documentService.getVolunteerDocumentsForEvent(eventId, userId);
        return ResponseEntity.ok(documents);
    }

    // 4. Dokumentum letöltése ID alapján
    @GetMapping("/download/{documentId}")
    public ResponseEntity<Resource> downloadDocument(@PathVariable Long documentId) {
        Document documentInfo = documentService.getDocumentInfo(documentId);
        Resource resource = documentService.downloadDocument(documentId);

        String contentType = documentInfo.getContentType();
        if (contentType == null || contentType.isEmpty()) {
            contentType = "application/octet-stream";
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + documentInfo.getOriginalFileName() + "\"")
                .body(resource);
    }

    // 5. Dokumentum törlése
    @DeleteMapping("/{documentId}")
    public ResponseEntity<Void> deleteDocument(@PathVariable Long documentId) {
        documentService.deleteDocument(documentId);
        return ResponseEntity.noContent().build();
    }
}