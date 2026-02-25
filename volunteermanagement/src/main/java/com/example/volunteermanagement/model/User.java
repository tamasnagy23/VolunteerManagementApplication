package com.example.volunteermanagement.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Entity
@Getter @Setter // Kiváló gyakorlat a JPA-nál!
@NoArgsConstructor @AllArgsConstructor
@Builder
@Table(name = "users")
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Column(unique = true)
    private String email;

    @JsonIgnore
    private String password;

    // Globális jogosultság
    @Enumerated(EnumType.STRING)
    private Role role;

    // --- 1. VÁLTOZÁS: ÚJ PROFIL MEZŐK ---
    private String phoneNumber;
    private String address;

    @Enumerated(EnumType.STRING)
    private Gender gender;

    private LocalDate dateOfBirth; // java.time.LocalDate import kell hozzá!

    // GDPR és ÁSZF elfogadásának ténye (mikor fogadta el)
    private LocalDateTime termsAcceptedAt;
    // ------------------------------------

    // --- 2. VÁLTOZÁS: A RÉGI @ManyToOne KAPCSOLAT TÖRLÉSRE KERÜLT ---
    // (A régi 'private Organization organization;' részt kivettük)

    // --- 3. VÁLTOZÁS: AZ ÚJ KAPCSOLÓTÁBLA BEKÖTÉSE ---
    @Builder.Default
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrganizationMember> memberships = new ArrayList<>();
    // ----------------------------------------------------------------

    @Builder.Default
    @ManyToMany(mappedBy = "volunteers")
    @JsonIgnore // Fontos, hogy ne legyen végtelen ciklus
    private List<Shift> shifts = new ArrayList<>();

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority(role.name()));
    }

    @Override
    public String getUsername() { return email; }
    @Override
    public boolean isAccountNonExpired() { return true; }
    @Override
    public boolean isAccountNonLocked() { return true; }
    @Override
    public boolean isCredentialsNonExpired() { return true; }
    @Override
    public boolean isEnabled() { return true; }

    // --- EZ A LÉNYEG: Csak az ID alapján egyenlő két User ---
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        User user = (User) o;
        return Objects.equals(id, user.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}