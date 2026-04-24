package com.example.volunteermanagement.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "announcement_comments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnnouncementComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "announcement_id", nullable = false)
    @JsonIgnore
    private Announcement announcement;

    // ÚJ: Szülő komment (ha ez egy válasz)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    @JsonIgnore
    private AnnouncementComment parentComment;

    // ÚJ: A kommentre érkezett válaszok
    @OneToMany(mappedBy = "parentComment", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    @Builder.Default
    private List<AnnouncementComment> replies = new ArrayList<>();

    // ÚJ: A kommentre érkezett reakciók
    @OneToMany(mappedBy = "comment", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<AnnouncementCommentReaction> reactions = new ArrayList<>();

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String userName;

    private String userAvatarUrl;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    private LocalDateTime createdAt;
}