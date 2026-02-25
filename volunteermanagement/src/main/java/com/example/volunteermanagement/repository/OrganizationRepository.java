package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Organization;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrganizationRepository extends JpaRepository<Organization, Long> {
    Optional<Organization> findByInviteCode(String inviteCode);
    Optional<Organization> findByCui(String cui);
}