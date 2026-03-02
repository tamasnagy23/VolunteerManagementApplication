package com.example.volunteermanagement.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "organization_members")
public class OrganizationMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnore
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    @JsonIgnore
    private Organization organization;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrganizationRole role;

    // --- ÚJ MEZŐ: STÁTUSZ ---
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private MembershipStatus status = MembershipStatus.PENDING;

    @Column(name = "joined_at")
    private LocalDateTime joinedAt;

    @Column(columnDefinition = "TEXT")
    private String rejectionMessage;
}