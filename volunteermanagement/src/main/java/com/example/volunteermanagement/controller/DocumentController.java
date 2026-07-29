package com.example.volunteermanagement.controller;

import com.example.volunteermanagement.dto.DocumentDTO;
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

    @PostMapping("/upload")
    public ResponseEntity<Document> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam("documentType") String documentType,
            @RequestParam("eventId") Long eventId,
            @RequestParam("tenantId") String tenantId,
            // A required = false miatt a szervező küldhet null-t, az önkéntes meg elküldi a saját ID-ját
            @RequestParam(value = "userId", required = false) Long userId) {

        Document savedDoc = documentService.uploadDocument(file, documentType, eventId, tenantId, userId);
        return ResponseEntity.ok(savedDoc);
    }

    @GetMapping("/event/{eventId}")
    public ResponseEntity<List<DocumentDTO>> getDocumentsByEvent(@PathVariable Long eventId) {
        return ResponseEntity.ok(documentService.getDocumentsByEvent(eventId));
    }

    // ÚJ VÉGPONT: Önkéntes lekérheti a saját feltöltött dokumentumait
    @GetMapping("/event/{eventId}/user/{userId}")
    public ResponseEntity<List<DocumentDTO>> getDocumentsByUserAndEvent(
            @PathVariable Long eventId,
            @PathVariable Long userId) {
        return ResponseEntity.ok(documentService.getDocumentsByUserAndEvent(userId, eventId));
    }

    @GetMapping("/download/{id}")
    public ResponseEntity<Resource> downloadDocument(@PathVariable Long id) {
        Resource resource = documentService.downloadDocument(id);

        // Beállítjuk a headereket, hogy a böngésző letöltésként kezelje a fájlt
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + resource.getFilename() + "\"")
                .body(resource);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDocument(@PathVariable Long id) {
        documentService.deleteDocument(id);
        return ResponseEntity.ok().build();
    }
}