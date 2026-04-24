package com.example.volunteermanagement.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "announcement_reactions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnnouncementReaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "announcement_id", nullable = false)
    @JsonIgnore
    private Announcement announcement;

    @Column(nullable = false)
    private Long userId;

    // Pl.: "LIKE", "HEART", "CLAP", "FIRE"
    @Column(nullable = false)
    private String reactionType;
}