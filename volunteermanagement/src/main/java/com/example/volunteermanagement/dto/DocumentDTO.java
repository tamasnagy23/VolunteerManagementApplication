package com.example.volunteermanagement.dto; // Módosítsd a saját csomagodra!

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class DocumentDTO {
    private Long id;
    private String originalFileName;
    private String contentType;
    private Long fileSize;
    private String documentType;
    private Long userId;          // Itt garantáljuk, hogy kimegy a frontendnek!
    private String uploaderName;  // Ez lesz az újdonság!
    private LocalDateTime uploadedAt;
}