package com.example.volunteermanagement.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
@Table(name = "organizations")
public class Organization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name; // Pl. "Sziget Kulturális Iroda"

    // Egyedi azonosító kód a meghívókhoz (pl. "SZIGET2026")
    @Column(unique = true)
    private String inviteCode;

    // Kapcsolat: Egy szervezetnek sok tagja (User) van
    @OneToMany(mappedBy = "organization", cascade = CascadeType.ALL)
    @JsonIgnore
    private List<User> members = new ArrayList<>();

    // Kapcsolat: Egy szervezetnek sok eseménye van
    @OneToMany(mappedBy = "organization", cascade = CascadeType.ALL)
    @JsonIgnore
    private List<Event> events = new ArrayList<>();
}