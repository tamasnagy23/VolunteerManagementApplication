package com.example.volunteermanagement.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "work_area")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkArea {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(length = 1000)
    private String description;

    @Column(nullable = false)
    private Integer capacity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    @JsonBackReference
    private Event event;

    @OneToMany(mappedBy = "workArea", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    @JsonIgnore
    private List<Shift> shifts = new ArrayList<>();

    // UPDATED MAPPINGS FOR THE NEW APPLICATION STRUCTURE

    // Applications that have this work area as preferred
    @ManyToMany(mappedBy = "preferredWorkAreas")
    @Builder.Default
    @JsonIgnore
    private List<Application> preferringApplications = new ArrayList<>();

    // Applications where this work area is the final assigned one
    @OneToMany(mappedBy = "assignedWorkArea")
    @Builder.Default
    @JsonIgnore
    private List<Application> assignedApplications = new ArrayList<>();
}