package com.example.volunteermanagement.repository;

import com.example.volunteermanagement.model.Organization;
import com.example.volunteermanagement.model.OrganizationMember;
import com.example.volunteermanagement.model.OrganizationRole;
import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.model.MembershipStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrganizationMemberRepository extends JpaRepository<OrganizationMember, Long> {
    List<OrganizationMember> findByUser(User user);
    List<OrganizationMember> findByOrganizationId(Long organizationId);
    long countByOrganizationAndRole(Organization organization, OrganizationRole role);

    // --- METÓDUSOK A JELENTKEZÉSEK ELBÍRÁLÁSÁHOZ (Egy státusz) ---
    // Megkeresi a globális adminnak az összes függőben lévő jelentkezést
    List<OrganizationMember> findByStatus(MembershipStatus status);

    // Megkeresi a vezetőnek csak a saját szervezeteihez tartozó jelentkezéseket
    List<OrganizationMember> findByStatusAndOrganizationIdIn(MembershipStatus status, List<Long> organizationIds);

    Optional<OrganizationMember> findByOrganizationAndUser(Organization organization, User user);

    // --- ÚJ METÓDUSOK A TÖRTÉNELEM (ARCHÍVUM) FÜLHÖZ (Több státusz) ---

    // Globális adminnak: visszaadja az összes olyan tagot, akiknek a státusza a megadott listában van
    List<OrganizationMember> findByStatusIn(List<MembershipStatus> statuses);

    // Szervezőnek: visszaadja azokat a tagokat a saját szervezeteiből, akik a megadott státuszokkal rendelkeznek
    List<OrganizationMember> findByStatusInAndOrganizationIdIn(List<MembershipStatus> statuses, List<Long> organizationIds);
}