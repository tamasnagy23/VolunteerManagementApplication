package com.example.volunteermanagement.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "application")
public class Application {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // --- JAVÍTVA: Csak az ID-t tároljuk a Master DB-ben élő Userből! ---
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    @JsonIgnore
    private Event event;

    @ManyToMany
    @JoinTable(
            name = "application_preferred_work_areas",
            joinColumns = @JoinColumn(name = "application_id"),
            inverseJoinColumns = @JoinColumn(name = "work_area_id")
    )
    @Builder.Default
    private List<WorkArea> preferredWorkAreas = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_work_area_id")
    private WorkArea assignedWorkArea;

    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    @JsonManagedReference
    private List<ApplicationAnswer> answers = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private ApplicationStatus status = ApplicationStatus.PENDING;

    private LocalDateTime appliedAt;

    @Column(columnDefinition = "TEXT")
    private String adminNote;

    @Column(columnDefinition = "TEXT")
    private String rejectionMessage;

    @Column(columnDefinition = "TEXT")
    private String withdrawalReason;

    @PrePersist
    protected void onCreate() {
        if (this.appliedAt == null) {
            this.appliedAt = LocalDateTime.now();
        }
        if (this.status == null) {
            this.status = ApplicationStatus.PENDING;
        }
    }
}