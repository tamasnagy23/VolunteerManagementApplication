package com.example.volunteermanagement.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDateTime;

@Entity
@Table(name = "event_question")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
// --- ÚJ: LÁTHATATLANSÁG KÖPENYE ÉS PUHA TÖRLÉS ---
@SQLDelete(sql = "UPDATE event_question SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
// -------------------------------------------------
public class EventQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String questionText; // pl. "Mi a pólóméreted?"

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private QuestionType questionType;

    // Ha a típus DROPDOWN vagy CHECKBOX, itt tároljuk a válaszlehetőségeket vesszővel elválasztva (pl. "S,M,L,XL")
    private String options;

    private boolean isRequired;

    // --- ÚJ MEZŐ: Törlés időpontja ---
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    @JsonBackReference
    private Event event;
}