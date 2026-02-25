package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Organization;
import com.example.volunteermanagement.model.Role;
import com.example.volunteermanagement.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    // Automatikusan generál SQL-t: SELECT * FROM users WHERE email = ?
    Optional<User> findByEmail(String email);
    // Megszámolja, hány user van egy adott szerepkörrel az egész rendszerben
    long countByRole(Role role);

    // Visszaadja azokat a usereket, akik tagjai a megadott szervezetek valamelyikének
    @Query("SELECT DISTINCT u FROM User u JOIN u.memberships m WHERE m.organization.id IN :orgIds")
    List<User> findUsersByOrganizationIds(@Param("orgIds") List<Long> orgIds);
}