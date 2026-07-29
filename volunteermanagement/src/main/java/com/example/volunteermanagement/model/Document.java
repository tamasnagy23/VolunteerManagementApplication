package com.example.volunteermanagement.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "documents")
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "stored_file_name", nullable = false)
    private String storedFileName;

    @Column(nullable = false)
    private String originalFileName;

    private String contentType;

    private Long fileSize;

    @Column(nullable = false)
    private String documentType;

    // Nincs fizikai SQL kapcsolat a master_db-vel, csak az ID-t tároljuk
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "event_id")
    private Long eventId;

    private String filePath;

    private LocalDateTime uploadedAt = LocalDateTime.now();
}