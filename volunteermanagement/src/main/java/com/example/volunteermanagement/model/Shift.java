package com.example.volunteermanagement.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "shifts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Shift {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_area_id", nullable = false)
    private WorkArea workArea;

    @Column(nullable = false)
    private LocalDateTime startTime;

    @Column(nullable = false)
    private LocalDateTime endTime;

    @Column(nullable = false)
    private int maxVolunteers;

    // --- ÚJ: A RÉGI @ManyToMany HELYETT AZ ÚJ KAPCSOLÓTÁBLÁT HASZNÁLJUK ---
    @Builder.Default
    @OneToMany(mappedBy = "shift", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ShiftAssignment> assignments = new ArrayList<>();
}