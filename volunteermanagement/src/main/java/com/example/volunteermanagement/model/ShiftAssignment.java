package com.example.volunteermanagement.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "shift_assignments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShiftAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shift_id", nullable = false)
    private Shift shift;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private AssignmentStatus status = AssignmentStatus.PENDING; // Alapból függőben van!

    @Column(columnDefinition = "TEXT")
    private String message; // Ha módosítást kér, ide írja
}