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

    // Ez mondja meg a frontendnek, hogy mit rajzoljon ki (TEXT, DROPDOWN, stb.)
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private QuestionType questionType;

    // --- ÚJ MEZŐ: Ez mondja meg a backendnek a funkciót ---
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(255) default 'GENERAL'")
    private QuestionPurpose purpose = QuestionPurpose.GENERAL;

    // Ha a típus DROPDOWN vagy CHECKBOX, itt tároljuk a válaszlehetőségeket vesszővel elválasztva (pl. "S,M,L,XL")
    private String options;

    private boolean isRequired;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    @JsonBackReference
    private Event event;
}