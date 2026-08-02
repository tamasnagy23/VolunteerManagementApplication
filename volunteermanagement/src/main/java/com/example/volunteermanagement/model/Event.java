package com.example.volunteermanagement.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDateTime;
import java.time.LocalTime; // <-- ÚJ IMPORT
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
@Table(name = "events")
@SQLDelete(sql = "UPDATE events SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String location;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "organization_id")
    @JsonIgnore
    private Organization organization;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime startTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime endTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime applicationDeadline;

    @Builder.Default
    @Column(nullable = false)
    private boolean isRegistrationOpen = true;

    // =========================================================
    // ÚJ: ÉTKEZÉSI IDŐSÁVOK (Napi ismétlődés, ezért LocalTime)
    // =========================================================
    @JsonFormat(pattern = "HH:mm")
    private LocalTime breakfastStartTime;

    @JsonFormat(pattern = "HH:mm")
    private LocalTime breakfastEndTime;

    @JsonFormat(pattern = "HH:mm")
    private LocalTime lunchStartTime;

    @JsonFormat(pattern = "HH:mm")
    private LocalTime lunchEndTime;

    @JsonFormat(pattern = "HH:mm")
    private LocalTime dinnerStartTime;

    @JsonFormat(pattern = "HH:mm")
    private LocalTime dinnerEndTime;
    // =========================================================

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    @JsonManagedReference
    private List<WorkArea> workAreas = new ArrayList<>();

    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    @JsonManagedReference
    private List<EventQuestion> questions = new ArrayList<>();

    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    @JsonIgnore
    private List<EventTeamMember> teamMembers = new ArrayList<>();

    @Column(name = "banner_url")
    private String bannerUrl;
}