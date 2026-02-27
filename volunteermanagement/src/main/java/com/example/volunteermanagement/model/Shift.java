package com.example.volunteermanagement.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
public class Shift {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private Integer maxVolunteers;

    private LocalDateTime startTime;
    private LocalDateTime endTime;

    // --- VÁLTOZÁS: Egy ember helyett (assignedUser) most TÖBB ember (volunteers) ---
    @ManyToMany
    @JoinTable(
            name = "shift_assignments",
            joinColumns = @JoinColumn(name = "shift_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private Set<User> volunteers = new HashSet<>();
    // -------------------------------------------------------------------------------

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_area_id", nullable = false)
    private WorkArea workArea;
}