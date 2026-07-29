package com.example.volunteermanagement.service;

import com.example.volunteermanagement.model.Document;
import com.example.volunteermanagement.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final FileStorageService fileStorageService;

    public Document uploadDocument(MultipartFile file, String documentType, String tenantId, Long eventId, Long userId) {
        String originalFileName = file.getOriginalFilename();
        String fileExtension = originalFileName != null && originalFileName.contains(".")
                ? originalFileName.substring(originalFileName.lastIndexOf("."))
                : "";
        String storedFileName = UUID.randomUUID().toString() + fileExtension;

        // Esemény-specifikus almappa kialakítása a szerveren
        String subFolder = "documents/" + tenantId + "/event_" + eventId;
        String filePath = fileStorageService.storeFile(file, storedFileName, subFolder);

        Document document = Document.builder()
                .originalFileName(originalFileName)
                .storedFileName(storedFileName)
                .filePath(filePath)
                .contentType(file.getContentType())
                .fileSize(file.getSize())
                .documentType(documentType)
                .tenantId(tenantId)
                .eventId(eventId)  // <--- ESEMÉNY BEKÖTVE
                .userId(userId)
                .uploadedAt(LocalDateTime.now())
                .build();

        return documentRepository.save(document);
    }

    public List<Document> getDocumentsByEvent(Long eventId) {
        return documentRepository.findByEventId(eventId);
    }

    public List<Document> getVolunteerDocumentsForEvent(Long eventId, Long userId) {
        return documentRepository.findByEventIdAndUserId(eventId, userId);
    }

    public Document getDocumentInfo(Long documentId) {
        return documentRepository.findById(documentId)
                .orElseThrow(() -> new RuntimeException("Document not found with id: " + documentId));
    }

    public Resource downloadDocument(Long documentId) {
        Document document = getDocumentInfo(documentId);
        return fileStorageService.loadFileAsResource(document.getFilePath());
    }

    public void deleteDocument(Long documentId) {
        Document document = getDocumentInfo(documentId);
        fileStorageService.deleteFile(document.getFilePath());
        documentRepository.delete(document);
    }
}