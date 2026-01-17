package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Organization;
import com.example.volunteermanagement.model.Role;
import com.example.volunteermanagement.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    // Automatikusan generál SQL-t: SELECT * FROM users WHERE email = ?
    Optional<User> findByEmail(String email);
    // Megszámolja, hány user van egy adott szerepkörrel az egész rendszerben
    long countByRole(Role role);

    // Megszámolja, hány user van egy adott szerepkörrel egy adott szervezeten belül
    long countByOrganizationAndRole(Organization organization, Role role);
}