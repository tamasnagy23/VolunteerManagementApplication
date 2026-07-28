package com.example.volunteermanagement.service;

import com.example.volunteermanagement.config.DataSourceConfig;
import com.example.volunteermanagement.dto.OrganizationDTO;
import com.example.volunteermanagement.dto.PendingApplicationDTO;
import com.example.volunteermanagement.model.*;
import com.example.volunteermanagement.repository.OrganizationMemberRepository;
import com.example.volunteermanagement.repository.OrganizationRepository;
import com.example.volunteermanagement.repository.UserRepository;
import com.example.volunteermanagement.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrganizationService {

    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationMemberRepository organizationMemberRepository;
    private final AuditLogService auditLogService;
    private final DataSourceConfig dataSourceConfig;

    @Autowired
    private TenantProvisioningService tenantProvisioningService;

    public List<OrganizationDTO> getAllOrganizations() {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            return organizationRepository.findAll().stream()
                    .map(org -> new OrganizationDTO(
                            org.getId(), org.getName(), org.getTenantId(),
                            org.getAddress(), org.getDescription(), org.getEmail(), org.getPhone(),
                            org.getLogoUrl(), org.getBannerUrl(), org.getCui()
                    )).collect(Collectors.toList());
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @Transactional
    public void joinOrganization(Long orgId, String userEmail) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("Felhasználó nem található"));
            Organization org = organizationRepository.findById(orgId)
                    .orElseThrow(() -> new RuntimeException("Szervezet nem található"));

            Optional<OrganizationMember> existingMembership = organizationMemberRepository.findByOrganizationAndUser(org, user);

            if (existingMembership.isPresent()) {
                OrganizationMember membership = existingMembership.get();
                if (membership.getStatus() == MembershipStatus.REJECTED ||
                        membership.getStatus() == MembershipStatus.LEFT ||
                        membership.getStatus() == MembershipStatus.REMOVED) {

                    membership.setStatus(MembershipStatus.PENDING);
                    membership.setRole(OrganizationRole.VOLUNTEER);
                    organizationMemberRepository.save(membership);

                    if (org.getTenantId() != null) {
                        String dbName = org.getTenantId() + "_db";
                        tenantProvisioningService.syncUserToTenantDatabase(dbName, user, org, membership);
                    }

                    auditLogService.logAction(userEmail, "REJOIN_ORGANIZATION", "Szervezet: " + org.getName(), "Újrajelentkezés a szervezetbe.", orgId);
                    return;
                } else {
                    throw new RuntimeException("Már jelentkeztél ide, vagy már tag vagy!");
                }
            }

            OrganizationMember newMember = new OrganizationMember();
            newMember.setOrganization(org);
            newMember.setUser(user);
            newMember.setRole(OrganizationRole.VOLUNTEER);
            newMember.setStatus(MembershipStatus.PENDING);
            organizationMemberRepository.save(newMember);

            auditLogService.logAction(userEmail, "JOIN_ORGANIZATION", "Szervezet ID: " + orgId, "A felhasználó jelentkezett a szervezetbe (Függő státusz).", orgId);
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @Transactional
    public void updateMemberRole(Long orgId, Long memberUserId, OrganizationRole newRole, String adminEmail) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            User admin = userRepository.findByEmail(adminEmail).orElseThrow();
            Organization org = organizationRepository.findById(orgId).orElseThrow();

            if (admin.getRole() != Role.SYS_ADMIN) {
                OrganizationMember adminMembership = organizationMemberRepository.findByOrganizationAndUser(org, admin)
                        .orElseThrow(() -> new RuntimeException("Nincs jogosultságod ebben a szervezetben!"));
                if (adminMembership.getRole() != OrganizationRole.OWNER && adminMembership.getRole() != OrganizationRole.ORGANIZER) {
                    throw new RuntimeException("Csak vezető módosíthat szerepkört!");
                }
            }

            User targetUser = userRepository.findById(memberUserId).orElseThrow();
            OrganizationMember member = organizationMemberRepository.findByOrganizationAndUser(org, targetUser)
                    .orElseThrow(() -> new RuntimeException("Tag nem található"));

            OrganizationRole oldRole = member.getRole();
            member.setRole(newRole);
            organizationMemberRepository.save(member);

            auditLogService.logAction(adminEmail, "ROLE_UPDATE", "Felhasználó: " + targetUser.getEmail(), "Szerepkör módosítva: " + oldRole + " -> " + newRole, orgId);
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    private java.util.Map<Long, java.util.Map<String, String>> fetchMasterDataForUsers(List<OrganizationMember> members) {
        java.util.Map<Long, java.util.Map<String, String>> masterDataMap = new java.util.HashMap<>();
        if (members == null || members.isEmpty()) return masterDataMap;

        List<Long> userIds = members.stream()
                .map(m -> m.getUser().getId())
                .distinct()
                .collect(Collectors.toList());

        String placeholders = String.join(",", java.util.Collections.nCopies(userIds.size(), "?"));
        String sql = "SELECT id, phone_number, profile_image_url FROM users WHERE id IN (" + placeholders + ")";

        try (java.sql.Connection conn = dataSourceConfig.getMasterDataSource().getConnection();
             java.sql.PreparedStatement ps = conn.prepareStatement(sql)) {
            int index = 1;
            for (Long id : userIds) {
                ps.setLong(index++, id);
            }
            try (java.sql.ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    java.util.Map<String, String> data = new java.util.HashMap<>();
                    data.put("phone", rs.getString("phone_number"));
                    data.put("image", rs.getString("profile_image_url"));
                    masterDataMap.put(rs.getLong("id"), data);
                }
            }
        } catch (Exception e) {
            log.error("Hiba a Mester adatbázis olvasásakor: ", e);
        }
        return masterDataMap;
    }

    private PendingApplicationDTO mapMembershipToDTO(OrganizationMember m, java.util.Map<Long, java.util.Map<String, String>> masterData) {
        java.util.Map<String, String> data = masterData.getOrDefault(m.getUser().getId(), java.util.Collections.emptyMap());
        String realPhone = data.get("phone") != null ? data.get("phone") : m.getUser().getPhoneNumber();
        String realImage = data.get("image") != null ? data.get("image") : m.getUser().getProfileImageUrl();

        return new PendingApplicationDTO(
                m.getId(), m.getUser().getName(), m.getUser().getEmail(), realPhone,
                m.getOrganization().getName(), m.getOrganization().getId(), null, null,
                m.getStatus().name(), null, null, java.util.Collections.emptyMap(),
                realImage, null, null, null,
                m.getRejectionMessage(), null
        );
    }

    @Transactional(readOnly = true)
    public List<PendingApplicationDTO> getPendingApplications(String adminEmail, Long requestedOrgId) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            User admin = userRepository.findByEmail(adminEmail).orElseThrow();
            List<OrganizationMember> pending;

            if (requestedOrgId != null) {
                if (admin.getRole() != Role.SYS_ADMIN) {
                    boolean hasAccess = admin.getMemberships().stream()
                            .filter(m -> m.getOrganization() != null) // <-- JAVÍTÁS: null védelem
                            .anyMatch(m -> m.getOrganization().getId().equals(requestedOrgId) &&
                                    m.getStatus() == MembershipStatus.APPROVED &&
                                    (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER));
                    if (!hasAccess) throw new RuntimeException("Nincs jogosultságod ehhez a szervezethez!");
                }
                pending = organizationMemberRepository.findByStatusAndOrganizationIdIn(MembershipStatus.PENDING, List.of(requestedOrgId));
            } else {
                if (admin.getRole() == Role.SYS_ADMIN) {
                    pending = organizationMemberRepository.findByStatus(MembershipStatus.PENDING);
                } else {
                    List<Long> myOrgIds = admin.getMemberships().stream()
                            .filter(m -> m.getOrganization() != null && m.getStatus() == MembershipStatus.APPROVED && // <-- JAVÍTÁS: null védelem
                                    (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER))
                            .map(m -> m.getOrganization().getId())
                            .collect(Collectors.toList());

                    if (myOrgIds.isEmpty()) return List.of();
                    pending = organizationMemberRepository.findByStatusAndOrganizationIdIn(MembershipStatus.PENDING, myOrgIds);
                }
            }

            java.util.Map<Long, java.util.Map<String, String>> masterData = fetchMasterDataForUsers(pending);
            return pending.stream().map(m -> mapMembershipToDTO(m, masterData)).collect(Collectors.toList());
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @Transactional
    public void handleApplication(Long membershipId, String status, String rejectionMessage, String adminEmail) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            User admin = userRepository.findByEmail(adminEmail).orElseThrow();
            OrganizationMember member = organizationMemberRepository.findById(membershipId)
                    .orElseThrow(() -> new RuntimeException("Jelentkezés nem található"));

            Organization org = member.getOrganization();
            Long orgId = org.getId();

            if (admin.getRole() != Role.SYS_ADMIN) {
                OrganizationMember adminMembership = organizationMemberRepository.findByOrganizationAndUser(org, admin)
                        .orElseThrow(() -> new RuntimeException("Nincs jogosultságod!"));
                if (adminMembership.getRole() != OrganizationRole.OWNER && adminMembership.getRole() != OrganizationRole.ORGANIZER) {
                    throw new RuntimeException("Csak vezető bírálhat el jelentkezést!");
                }
            }

            if ("APPROVED".equalsIgnoreCase(status)) {
                member.setStatus(MembershipStatus.APPROVED);
                member.setRejectionMessage(null);

                if (org.getTenantId() != null) {
                    String dbName = org.getTenantId() + "_db";
                    tenantProvisioningService.syncUserToTenantDatabase(dbName, member.getUser(), org, member);
                }

                auditLogService.logAction(adminEmail, "APPROVE_MEMBERSHIP", "Tag: " + member.getUser().getEmail(), "Jelentkezés elfogadva.", orgId);
            } else if ("REJECTED".equalsIgnoreCase(status)) {
                member.setStatus(MembershipStatus.REJECTED);
                member.setRejectionMessage(rejectionMessage);
                auditLogService.logAction(adminEmail, "REJECT_MEMBERSHIP", "Tag: " + member.getUser().getEmail(), "Jelentkezés elutasítva. Indok: " + rejectionMessage, orgId);
            }

            organizationMemberRepository.save(member);
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @Transactional
    public void leaveOrganization(Long orgId, String userEmail) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            User user = userRepository.findByEmail(userEmail).orElseThrow();
            OrganizationMember member = user.getMemberships().stream()
                    .filter(m -> m.getOrganization() != null && m.getOrganization().getId().equals(orgId)) // <-- JAVÍTÁS: null védelem
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("Nem vagy tagja ennek a szervezetnek!"));

            if (member.getRole() == OrganizationRole.OWNER) {
                throw new RuntimeException("Alapítóként nem léphetsz ki!");
            }

            member.setStatus(MembershipStatus.LEFT);
            organizationMemberRepository.save(member);

            auditLogService.logAction(userEmail, "LEAVE_ORGANIZATION", "Szervezet ID: " + orgId, "A felhasználó kilépett a szervezetből.", orgId);
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @Transactional
    public void removeMember(Long orgId, Long memberUserId, String requesterEmail, String reason) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            User requester = userRepository.findByEmail(requesterEmail).orElseThrow();
            Organization org = organizationRepository.findById(orgId).orElseThrow();

            if (requester.getRole() != Role.SYS_ADMIN) {
                OrganizationMember requesterMembership = organizationMemberRepository.findByOrganizationAndUser(org, requester)
                        .orElseThrow(() -> new RuntimeException("Nincs jogosultságod!"));

                if (requesterMembership.getRole() == OrganizationRole.VOLUNTEER) {
                    throw new RuntimeException("Önkéntesek nem távolíthatnak el tagokat!");
                }
            }

            User userToRemove = userRepository.findById(memberUserId).orElseThrow();
            OrganizationMember memberToRemove = organizationMemberRepository.findByOrganizationAndUser(org, userToRemove).orElseThrow();

            if (memberToRemove.getRole() == OrganizationRole.OWNER) {
                throw new RuntimeException("Alapítót nem lehet eltávolítani!");
            }

            memberToRemove.setStatus(MembershipStatus.REMOVED);
            memberToRemove.setRejectionMessage(reason);
            organizationMemberRepository.save(memberToRemove);

            if (org.getTenantId() != null) {
                String dbName = org.getTenantId() + "_db";
                tenantProvisioningService.syncUserToTenantDatabase(dbName, userToRemove, org, memberToRemove);
            }

            auditLogService.logAction(requesterEmail, "REMOVE_MEMBER", "Eltávolított felhasználó: " + userToRemove.getEmail(), "Indok: " + reason, orgId);
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @Transactional
    public void restoreMember(Long membershipId, String requesterEmail) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            User requester = userRepository.findByEmail(requesterEmail).orElseThrow();
            OrganizationMember memberToRestore = organizationMemberRepository.findById(membershipId)
                    .orElseThrow(() -> new RuntimeException("Tag (Tagság) nem található"));

            Organization org = memberToRestore.getOrganization();
            Long orgId = org.getId();

            if (requester.getRole() != Role.SYS_ADMIN) {
                OrganizationMember requesterMembership = organizationMemberRepository.findByOrganizationAndUser(org, requester)
                        .orElseThrow(() -> new RuntimeException("Nincs jogosultságod!"));

                if (requesterMembership.getRole() == OrganizationRole.VOLUNTEER) {
                    throw new RuntimeException("Önkéntesek nem állíthatnak vissza tagokat!");
                }
            }

            if (memberToRestore.getStatus() == MembershipStatus.APPROVED || memberToRestore.getStatus() == MembershipStatus.PENDING) {
                throw new RuntimeException("Ez a felhasználó már aktív vagy a jelentkezése folyamatban van.");
            }

            memberToRestore.setStatus(MembershipStatus.APPROVED);
            memberToRestore.setRejectionMessage(null);

            if (memberToRestore.getRole() == null) {
                memberToRestore.setRole(OrganizationRole.VOLUNTEER);
            }
            organizationMemberRepository.save(memberToRestore);

            if (org.getTenantId() != null) {
                String dbName = org.getTenantId() + "_db";
                tenantProvisioningService.syncUserToTenantDatabase(dbName, memberToRestore.getUser(), org, memberToRestore);
            }

            auditLogService.logAction(requesterEmail, "RESTORE_MEMBER", "Visszaállított felhasználó: " + memberToRestore.getUser().getEmail(), "A tag visszakerült az aktív csapatba.", orgId);
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @Transactional(readOnly = true)
    public List<PendingApplicationDTO> getHistory(String adminEmail, Long requestedOrgId) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            User admin = userRepository.findByEmail(adminEmail).orElseThrow();
            List<MembershipStatus> historyStatuses = List.of(MembershipStatus.LEFT, MembershipStatus.REJECTED, MembershipStatus.REMOVED);
            List<OrganizationMember> history;

            if (requestedOrgId != null) {
                if (admin.getRole() != Role.SYS_ADMIN) {
                    boolean hasAccess = admin.getMemberships().stream()
                            .filter(m -> m.getOrganization() != null) // <-- JAVÍTÁS: null védelem
                            .anyMatch(m -> m.getOrganization().getId().equals(requestedOrgId) &&
                                    m.getStatus() == MembershipStatus.APPROVED &&
                                    (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER));
                    if (!hasAccess) throw new RuntimeException("Nincs jogosultságod ehhez a szervezethez!");
                }
                history = organizationMemberRepository.findByStatusInAndOrganizationIdIn(historyStatuses, List.of(requestedOrgId));
            } else {
                if (admin.getRole() == Role.SYS_ADMIN) {
                    history = organizationMemberRepository.findByStatusIn(historyStatuses);
                } else {
                    List<Long> myOrgIds = admin.getMemberships().stream()
                            .filter(m -> m.getOrganization() != null && m.getStatus() == MembershipStatus.APPROVED && // <-- JAVÍTÁS: null védelem
                                    (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER))
                            .map(m -> m.getOrganization().getId())
                            .collect(Collectors.toList());

                    if (myOrgIds.isEmpty()) return List.of();
                    history = organizationMemberRepository.findByStatusInAndOrganizationIdIn(historyStatuses, myOrgIds);
                }
            }

            java.util.Map<Long, java.util.Map<String, String>> masterData = fetchMasterDataForUsers(history);

            return history.stream().map(m -> {
                java.util.Map<String, String> data = masterData.getOrDefault(m.getUser().getId(), java.util.Collections.emptyMap());
                String realImage = data.get("image") != null ? data.get("image") : m.getUser().getProfileImageUrl();

                return new PendingApplicationDTO(
                        m.getId(), m.getUser().getName(), m.getUser().getEmail(),
                        "Rejtett adat (GDPR)",
                        m.getOrganization().getName(), m.getOrganization().getId(), null, null,
                        m.getStatus().name(), null, null, java.util.Collections.emptyMap(),
                        realImage, null, null, null, m.getRejectionMessage(), null
                );
            }).collect(Collectors.toList());
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @Transactional
    public void updateOrganizationDetails(Long orgId, OrganizationDTO dto, String requesterEmail) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            User user = userRepository.findByEmail(requesterEmail).orElseThrow();
            Organization org = organizationRepository.findById(orgId).orElseThrow();

            boolean isSysAdmin = user.getRole() == Role.SYS_ADMIN;
            boolean isLeader = user.getMemberships().stream()
                    .filter(m -> m.getOrganization() != null) // <-- JAVÍTÁS: null védelem
                    .anyMatch(m -> m.getOrganization().getId().equals(orgId) &&
                            m.getStatus() == MembershipStatus.APPROVED &&
                            (m.getRole() == OrganizationRole.OWNER || m.getRole() == OrganizationRole.ORGANIZER));

            if (!isSysAdmin && !isLeader) {
                throw new RuntimeException("Nincs jogosultságod a szervezet adatainak szerkesztéséhez!");
            }

            org.setName(dto.name());
            org.setAddress(dto.address());
            org.setDescription(dto.description());
            org.setEmail(dto.email());
            org.setPhone(dto.phone());
            org.setCui(dto.cui());

            organizationRepository.save(org);

            auditLogService.logAction(requesterEmail, "ORG_UPDATED", "Szervezet: " + org.getName(), "Szervezeti adatok frissítve.", orgId);
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    @Transactional(readOnly = true)
    public OrganizationDTO getOrganizationById(Long id) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            Organization org = organizationRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Szervezet nem található"));

            return new OrganizationDTO(
                    org.getId(), org.getName(), org.getTenantId(), org.getAddress(),
                    org.getDescription(), org.getEmail(), org.getPhone(), org.getLogoUrl(),
                    org.getBannerUrl(), org.getCui()
            );
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    // =========================================================================
    // SZERVEZET LÉTREHOZÁSA INTELLIGENS NÉV-ZÁROLÁSSAL ÉS VISSZAÁLLÍTÁSSAL
    // =========================================================================
    @Transactional
    public OrganizationDTO createOrganization(OrganizationDTO dto, String userEmail, Boolean forceCreateNew) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear(); // Biztosítjuk, hogy a Mester DB-be írunk

            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("Felhasználó nem található!"));

            // 1. Átlátunk a láthatatlansági köpenyen: létezik-e már ez a név (akár törölve is)?
            Optional<Organization> existingOrgOpt = organizationRepository.findByNameWithDeleted(dto.name());

            if (existingOrgOpt.isPresent()) {
                Organization existingOrg = existingOrgOpt.get();

                // A) Ha a szervezet AKTÍV (nincs kitöltve a deletedAt), senki sem regisztrálhatja újra
                if (existingOrg.getDeletedAt() == null) {
                    throw new RuntimeException("Ilyen nevű aktív szervezet már létezik!");
                }
                // B) Ha a szervezet TÖRÖLT (Soft Deleted) állapotban van (30 napon belül vagyunk)
                else {
                    boolean isOwner = existingOrg.getMembers().stream()
                            .anyMatch(m -> m.getUser().getId().equals(user.getId()) && m.getRole() == OrganizationRole.OWNER);
                    boolean isSysAdmin = user.getRole() == Role.SYS_ADMIN;

                    // Ha az eredeti Alapító vagy a Rendszergazda próbálkozik
                    if (isOwner || isSysAdmin) {
                        if (forceCreateNew == null) {
                            // Első körben visszaszólunk a frontendnek, hogy döntenie kell
                            throw new RuntimeException("ORG_EXISTS_DELETED_OWNER");
                        } else if (!forceCreateNew) {
                            // DÖNTÉS: VISSZAÁLLÍTÁS ÉS FRISSÍTÉS
                            existingOrg.setDeletedAt(null); // <-- JAVÍTÁS: Csak ezt nullázzuk a visszahozáshoz!
                            existingOrg.setAddress(dto.address());
                            existingOrg.setDescription(dto.description());
                            existingOrg.setEmail(dto.email());
                            existingOrg.setPhone(dto.phone());
                            existingOrg.setCui(dto.cui());
                            organizationRepository.save(existingOrg);

                            // A korábban eltávolított tagságot újra aktiváljuk APPROVED-ra
                            existingOrg.getMembers().stream()
                                    .filter(m -> m.getUser().getId().equals(user.getId()))
                                    .findFirst()
                                    .ifPresent(m -> {
                                        m.setStatus(MembershipStatus.APPROVED);
                                        organizationMemberRepository.save(m);
                                    });

                            auditLogService.logActionWithOrgName(userEmail, "RESTORE_ORGANIZATION", "Szervezet: " + existingOrg.getName(), "Törölt szervezet visszaállítva és frissítve.", existingOrg.getId(), existingOrg.getName());

                            return new OrganizationDTO(
                                    existingOrg.getId(), existingOrg.getName(), existingOrg.getTenantId(), existingOrg.getAddress(),
                                    existingOrg.getDescription(), existingOrg.getEmail(), existingOrg.getPhone(), existingOrg.getLogoUrl(),
                                    existingOrg.getBannerUrl(), existingOrg.getCui()
                            );
                        }
                        // Ha forceCreateNew == true, akkor az alapító újat kért, átlépünk az átnevezésre
                    } else {
                        // BIZTONSÁGI PAJZS: Ha egy IDEGEN akarja ellopni a nevet a 30 napos ablak alatt
                        throw new RuntimeException("Ez a szervezetnév jelenleg zárolás alatt áll (felülvizsgálati időszak).");
                    }

                    // Ha teljesen új szervezet indítása mellett döntöttünk, felszabadítjuk a nevet
                    // Úgy alakítjuk át, hogy a name és cui egyedisége megszűnjön, de a tenant_id sértetlen marad a robotnak!
                    String timestampSuffix = "_deleted_" + System.currentTimeMillis();
                    existingOrg.setName(existingOrg.getName() + timestampSuffix);
                    if (existingOrg.getCui() != null) {
                        existingOrg.setCui(existingOrg.getCui() + timestampSuffix);
                    }
                    organizationRepository.save(existingOrg);
                    organizationRepository.flush();
                }
            }

            // 2. Új szervezet entitás elmentése a tiszta sorszámozott ID érdekében
            Organization org = new Organization();
            org.setName(dto.name());
            org.setDescription(dto.description());
            org.setAddress(dto.address());
            org.setEmail(dto.email());
            org.setPhone(dto.phone());
            org.setCui(dto.cui());
            Organization savedOrg = organizationRepository.save(org);

            // Ékezetmentesítés és tisztítás az adatbázisnévhez
            String safeName = dto.name().toLowerCase()
                    .replaceAll("[áàä]", "a").replaceAll("[éèë]", "e")
                    .replaceAll("[íìï]", "i").replaceAll("[óòöő]", "o")
                    .replaceAll("[úùüű]", "u")
                    .replaceAll("[^a-z0-9]", "_")
                    .replaceAll("_+", "_")
                    .replaceAll("^_|_$", "");

            if (safeName.isEmpty()) safeName = "org";

            String tenantId = safeName + "_" + savedOrg.getId();
            String dbName = tenantId + "_db";

            savedOrg.setTenantId(tenantId);
            savedOrg = organizationRepository.save(savedOrg);

            // Alapítói tagság létrehozása
            OrganizationMember owner = new OrganizationMember();
            owner.setOrganization(savedOrg);
            owner.setUser(user);
            owner.setRole(OrganizationRole.OWNER);
            owner.setStatus(MembershipStatus.APPROVED);
            OrganizationMember savedOwner = organizationMemberRepository.save(owner);

            // ÚJ: Azonnali memória-frissítés a JWT Token generátor számára!
            if (user.getMemberships() != null) {
                user.getMemberships().add(savedOwner);
            }

            // Új bérlői adatbázis (Sziget) felépítése
            tenantProvisioningService.createNewTenantDatabase(tenantId, dbName, savedOrg, user, savedOwner);

            auditLogService.logActionWithOrgName(userEmail, "CREATE_ORGANIZATION", "Szervezet: " + savedOrg.getName(), "Új szervezet és bérlői adatbázis létrehozva.", savedOrg.getId(), savedOrg.getName());

            return new OrganizationDTO(
                    savedOrg.getId(), savedOrg.getName(), savedOrg.getTenantId(), savedOrg.getAddress(),
                    savedOrg.getDescription(), savedOrg.getEmail(), savedOrg.getPhone(), savedOrg.getLogoUrl(),
                    savedOrg.getBannerUrl(), savedOrg.getCui()
            );
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }

    // =========================================================================
    // JAVÍTÁS 2: SOFT DELETE JAVÍTÁSA - AUTOMATIKUS TAGSÁG DEAKTIVÁLÁSSAL
    // =========================================================================
    @Transactional
    public void softDeleteOrganization(Long orgId, String requesterEmail) {
        String originalTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.clear();
            User user = userRepository.findByEmail(requesterEmail).orElseThrow();
            Organization org = organizationRepository.findById(orgId).orElseThrow();

            boolean isSysAdmin = user.getRole() == Role.SYS_ADMIN;
            boolean isOwner = user.getMemberships().stream()
                    .filter(m -> m.getOrganization() != null) // null-védelem a már meglévő hibás adatokra
                    .anyMatch(m -> m.getOrganization().getId().equals(orgId) &&
                            m.getStatus() == MembershipStatus.APPROVED &&
                            m.getRole() == OrganizationRole.OWNER);

            if (!isSysAdmin && !isOwner) {
                throw new RuntimeException("Csak a szervezet Alapítója vagy a Rendszergazda törölheti a szervezetet!");
            }

            // A ZSENIÁLIS TRÜKK: Végigmegyünk a szervezet tagjain, és mindet átrakjuk REMOVED-ra!
            if (org.getMembers() != null) {
                for (OrganizationMember m : org.getMembers()) {
                    m.setStatus(MembershipStatus.REMOVED);
                }
            }

            // ÚJ: Manuálisan beállítjuk a törlés időpontját a memóriában lévő objektumon,
            // hogy a JWT generátor érzékelje, hogy ez a szervezet már halott!
            org.setDeletedAt(java.time.LocalDateTime.now());

            // A modelleden lévő @SQLDelete miatt ez nem töröl, hanem beállítja a deleted_at időbélyeget a DB-ben!
            organizationRepository.delete(org);

            auditLogService.logAction(requesterEmail, "DELETE_ORGANIZATION", "Szervezet: " + org.getName(), "Szervezet logikai törlése (Soft Delete) megtörtént, tagságok deaktiválva.", orgId);
        } finally {
            TenantContext.setCurrentTenant(originalTenant);
        }
    }
}