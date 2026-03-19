package com.example.volunteermanagement.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.util.HashSet;
import java.util.Set;

@Entity
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
@Table(name = "event_team_members")
public class EventTeamMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnore
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    @JsonIgnore
    private Event event;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EventRole role; // ORGANIZER vagy COORDINATOR

    // A finomhangolt jogosultságok (plecsnik) listája
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "event_team_member_permissions", joinColumns = @JoinColumn(name = "team_member_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "permission")
    @Builder.Default
    private Set<EventPermission> permissions = new HashSet<>();
}