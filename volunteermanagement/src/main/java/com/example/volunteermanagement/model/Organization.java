package com.example.volunteermanagement.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "organizations")
public class Organization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    private String address;

    @Column(unique = true)
    private String cui; // Adószám / Cégjegyzékszám

    @Column(unique = true)
    private String inviteCode;

    // --- KAPCSOLAT A TAGSÁGOKKAL ---
    @Builder.Default
    @OneToMany(mappedBy = "organization", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<OrganizationMember> members = new ArrayList<>();

    @Column(columnDefinition = "TEXT")
    private String description;

    private String email;

    private String phone;
}