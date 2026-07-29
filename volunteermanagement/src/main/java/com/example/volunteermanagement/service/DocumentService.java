package com.example.volunteermanagement.service;

import com.example.volunteermanagement.dto.DocumentDTO; // <-- JAVÍTVA
import com.example.volunteermanagement.model.Document;
import com.example.volunteermanagement.repository.DocumentRepository;
import com.example.volunteermanagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final FileStorageService fileStorageService;
    private final UserRepository userRepository;

    @Transactional
    public Document uploadDocument(MultipartFile file, String documentType, Long eventId, String tenantId, Long userId) {

        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document";
        String extension = originalFilename.contains(".") ? originalFilename.substring(originalFilename.lastIndexOf(".")) : "";
        String storedFileName = UUID.randomUUID().toString() + extension;

        String subFolder = "documents/" + tenantId + "/event_" + eventId;
        String filePath = fileStorageService.storeFile(file, storedFileName, subFolder);

        Document document = new Document();
        document.setOriginalFileName(file.getOriginalFilename());
        document.setStoredFileName(storedFileName);
        document.setContentType(file.getContentType());
        document.setFileSize(file.getSize());
        document.setDocumentType(documentType);
        document.setEventId(eventId);
        document.setUserId(userId);
        document.setFilePath(filePath);

        return documentRepository.save(document);
    }

    public List<DocumentDTO> getDocumentsByEvent(Long eventId) { // <-- JAVÍTVA
        List<Document> documents = documentRepository.findByEventId(eventId);
        return documents.stream().map(this::convertToDto).collect(Collectors.toList());
    }

    public List<DocumentDTO> getDocumentsByUserAndEvent(Long userId, Long eventId) { // <-- JAVÍTVA
        List<Document> documents = documentRepository.findByEventId(eventId).stream()
                .filter(doc -> userId.equals(doc.getUserId()))
                .collect(Collectors.toList());

        return documents.stream().map(this::convertToDto).collect(Collectors.toList());
    }

    private DocumentDTO convertToDto(Document doc) { // <-- JAVÍTVA
        DocumentDTO dto = new DocumentDTO(); // <-- JAVÍTVA
        dto.setId(doc.getId());
        dto.setOriginalFileName(doc.getOriginalFileName());
        dto.setContentType(doc.getContentType());
        dto.setFileSize(doc.getFileSize());
        dto.setDocumentType(doc.getDocumentType());
        dto.setUserId(doc.getUserId());
        dto.setUploadedAt(doc.getUploadedAt());

        if (doc.getUserId() != null) {
            userRepository.findById(doc.getUserId())
                    .ifPresent(user -> dto.setUploaderName(user.getName()));
        }

        return dto;
    }

    public Resource downloadDocument(Long documentId) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new RuntimeException("Dokumentum nem található!"));

        return fileStorageService.loadFileAsResource(document.getFilePath());
    }

    @Transactional
    public void deleteDocument(Long documentId) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new RuntimeException("Dokumentum nem található!"));

        fileStorageService.deleteFile(document.getFilePath());
        documentRepository.delete(document);
    }
}