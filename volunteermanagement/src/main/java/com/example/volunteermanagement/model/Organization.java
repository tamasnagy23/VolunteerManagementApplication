package com.example.volunteermanagement.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "organizations")
// --- ÚJ: LÁTHATATLANSÁG KÖPENYE ÉS PUHA TÖRLÉS ---
@SQLDelete(sql = "UPDATE organizations SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
// -------------------------------------------------
public class Organization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(unique = true)
    private String tenantId;

    private String address;

    @Column(unique = true)
    private String cui;

    @Column(unique = true)
    private String inviteCode;

    // --- ÚJ MEZŐ: Törlés időpontja ---
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Builder.Default
    @OneToMany(mappedBy = "organization", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<OrganizationMember> members = new ArrayList<>();

    @Column(columnDefinition = "TEXT")
    private String description;

    private String email;

    private String phone;

    // A többi mező alá...
    @Column(name = "logo_url")
    private String logoUrl;

    @Column(name = "banner_url")
    private String bannerUrl;
}