package com.example.volunteermanagement.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "work_area")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
// --- ÚJ: LÁTHATATLANSÁG KÖPENYE ÉS PUHA TÖRLÉS ---
@SQLDelete(sql = "UPDATE work_area SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
// -------------------------------------------------
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

    // --- ÚJ MEZŐ: Törlés időpontja ---
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

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

    // --- ÚJ: A Munkaterület Koordinátorai ---
    // JAVÍTVA: Nem a User objektumot, hanem csak az ID-jukat mentjük le a Tenant DB-ben!
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "work_area_coordinators", joinColumns = @JoinColumn(name = "work_area_id"))
    @Column(name = "user_id")
    private List<Long> coordinatorIds = new ArrayList<>();
}