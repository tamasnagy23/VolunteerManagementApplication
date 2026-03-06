package com.example.volunteermanagement.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

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

    // A műszak egy konkrét munkaterülethez tartozik
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_area_id", nullable = false)
    private WorkArea workArea;

    @Column(nullable = false)
    private LocalDateTime startTime;

    @Column(nullable = false)
    private LocalDateTime endTime;

    @Column(nullable = false)
    private int maxVolunteers;

    @ManyToMany
    @JoinTable(
            name = "shift_assignments",
            joinColumns = @JoinColumn(name = "shift_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private List<User> volunteers = new ArrayList<>();
}