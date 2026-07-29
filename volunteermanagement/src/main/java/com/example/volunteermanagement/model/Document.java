package com.example.volunteermanagement.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "documents")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String originalFileName;
    private String storedFileName;
    private String filePath;
    private String contentType;
    private Long fileSize;

    private String documentType; // pl. "TEMPLATE", "SIGNED_CONTRACT"

    private String tenantId;
    private Long eventId;        // <--- BEKERÜLT AZ ESEMÉNY ID
    private Long userId;         // Nullable, pl. a sablonoknál nincs userId, csak a visszatöltött fájloknál

    private LocalDateTime uploadedAt;
}