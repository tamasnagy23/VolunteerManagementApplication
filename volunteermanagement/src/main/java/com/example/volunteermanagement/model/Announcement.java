package com.example.volunteermanagement.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "announcements")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Announcement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @ElementCollection
    @CollectionTable(name = "announcement_images", joinColumns = @JoinColumn(name = "announcement_id"))
    @Column(name = "image_url")
    @Builder.Default
    private List<String> imageUrls = new ArrayList<>();

    @Column(nullable = false)
    private String authorName;

    @Column(nullable = false)
    private Long authorId;

    private String authorAvatarUrl;

    // CÉLZÁSI RENDSZER (Ami null, arra nem vonatkozik a szűrés)
    private Long organizationId; // Szervezeti poszt
    private Long eventId;        // Esemény poszt
    private Long workAreaId;     // Koordinátori poszt (konkrét munkaterület)

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "announcement", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    @Builder.Default
    private List<AnnouncementComment> comments = new ArrayList<>();

    @OneToMany(mappedBy = "announcement", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<AnnouncementReaction> reactions = new ArrayList<>();
}