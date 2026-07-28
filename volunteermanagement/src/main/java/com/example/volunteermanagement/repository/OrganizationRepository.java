package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface OrganizationRepository extends JpaRepository<Organization, Long> {
    Optional<Organization> findByInviteCode(String inviteCode);
    Optional<Organization> findByCui(String cui);

    // ÚJ: Natív SQL a Hibernate "Láthatatlanság Köpenyének" megkerüléséhez
    @Query(value = "SELECT * FROM organizations WHERE name = ?1", nativeQuery = true)
    Optional<Organization> findByNameWithDeleted(String name);
}