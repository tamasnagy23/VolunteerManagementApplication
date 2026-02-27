package com.example.volunteermanagement.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "application_answer")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ApplicationAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    @JsonBackReference
    private Application application;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private EventQuestion question;

    @Column(columnDefinition = "TEXT")
    private String answerText; // Ide kerül maga a válasz (pl. "XL" vagy "Péntek, Szombat")
}