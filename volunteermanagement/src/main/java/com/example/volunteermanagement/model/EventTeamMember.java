package com.example.volunteermanagement.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
@Table(name = "event_team_members")
// --- ÚJ: LÁTHATATLANSÁG KÖPENYE ÉS PUHA TÖRLÉS ---
@SQLDelete(sql = "UPDATE event_team_members SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
// -------------------------------------------------
public class EventTeamMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // --- JAVÍTVA: A User helyett csak a userId-t tároljuk (Mivel a User a Master DB-ben van!) ---
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    @JsonIgnore
    private Event event;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EventRole role;

    // --- ÚJ MEZŐ: Törlés időpontja ---
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "event_team_member_permissions", joinColumns = @JoinColumn(name = "team_member_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "permission")
    @Builder.Default
    private Set<EventPermission> permissions = new HashSet<>();
}