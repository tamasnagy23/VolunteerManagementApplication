package com.example.volunteermanagement.config;

import com.example.volunteermanagement.model.Organization;
import com.example.volunteermanagement.repository.OrganizationRepository;
import com.example.volunteermanagement.tenant.TenantContext;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class TenantSchemaUpdater implements CommandLineRunner {

    private final OrganizationRepository organizationRepository;
    private final JdbcTemplate jdbcTemplate;

    public TenantSchemaUpdater(OrganizationRepository organizationRepository, JdbcTemplate jdbcTemplate) {
        this.organizationRepository = organizationRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) throws Exception {
        List<Organization> organizations = organizationRepository.findAll();

        // A dokumentum tábla létrehozása (eredeti kódod)
        String createTableSql = """
            CREATE TABLE IF NOT EXISTS documents (
                id BIGSERIAL PRIMARY KEY,
                stored_file_name VARCHAR(255) NOT NULL,
                original_file_name VARCHAR(255) NOT NULL,
                content_type VARCHAR(255),
                file_size BIGINT,
                document_type VARCHAR(255) NOT NULL,
                user_id BIGINT,
                event_id BIGINT,
                file_path VARCHAR(255),
                uploaded_at TIMESTAMP
            );
        """;

        // --- ÚJ SQL: Az étkezési napló tábla létrehozása ---
        String createMealLogTableSql = """
            CREATE TABLE IF NOT EXISTS meal_consumption_log (
                id BIGSERIAL PRIMARY KEY,
                volunteer_id BIGINT NOT NULL,
                event_id BIGINT NOT NULL,
                scanned_by_id BIGINT NOT NULL,
                meal_type VARCHAR(255) NOT NULL,
                consumed_at TIMESTAMP NOT NULL,
                dietary_preference VARCHAR(255)
            );
        """;

        // A jogosultság ellenőrzés frissítése
        String dropConstraintSql = "ALTER TABLE event_team_members DROP CONSTRAINT IF EXISTS event_team_members_role_check;";
        String addConstraintSql = "ALTER TABLE event_team_members ADD CONSTRAINT event_team_members_role_check CHECK (role IN ('ORGANIZER', 'COORDINATOR', 'MEAL_SCANNER'));";

        System.out.println("⏳ Tenant adatbázisok sémájának ellenőrzése és frissítése...");

        for (Organization org : organizations) {
            String tenantId = org.getTenantId();

            if (tenantId == null || tenantId.trim().isEmpty()) {
                continue;
            }

            try {
                TenantContext.setCurrentTenant(tenantId);

                // 1. Lefuttatjuk a dokumentum tábla ellenőrzést
                jdbcTemplate.execute(createTableSql);

                // 2. Lefuttatjuk az ÚJ étkezési napló tábla létrehozását
                jdbcTemplate.execute(createMealLogTableSql);

                // 3. Lefuttatjuk a jogosultság constraint frissítését
                jdbcTemplate.execute(dropConstraintSql);
                jdbcTemplate.execute(addConstraintSql);

                System.out.println("✅ Séma és jogosultságok frissítve a tenantban: " + tenantId);
            } catch (Exception e) {
                System.err.println("❌ Hiba a tenant frissítésekor (" + tenantId + "): " + e.getMessage());
            } finally {
                TenantContext.clear();
            }
        }

        System.out.println("🚀 Tenant sémák frissítése befejeződött!");
    }
}