package com.example.volunteermanagement.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDateTime timestamp;
    private String userEmail; // Aki a műveletet végezte
    private String action;    // A művelet típusa (pl. "JOIN_ORG", "REJECT_APP")
    private String target;    // Kire/Mire irányult (pl. "Szervezet ID: 1")
    private Long organizationId; // ÚJ MEZŐ: Ha null, akkor rendszer szintű (pl. login), ha van értéke, szervezeti.
    private String organizationName;

    @Column(columnDefinition = "TEXT")
    private String details;   // Bővebb leírás
}