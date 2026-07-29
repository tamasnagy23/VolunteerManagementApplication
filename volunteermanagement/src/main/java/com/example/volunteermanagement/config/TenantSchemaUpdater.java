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
        // 1. Lekérjük az összes létező szervezetet
        List<Organization> organizations = organizationRepository.findAll();

        // 2. A táblát létrehozó SQL parancs (IF NOT EXISTS - így nem ront el semmit, ha már létezik)
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

        System.out.println("⏳ Tenant adatbázisok sémájának ellenőrzése és frissítése...");

        // 3. Végigmegyünk az összes szervezeten
        for (Organization org : organizations) {
            // A dedikált tenantId mezőt kérjük le (ami nálad már eleve String)
            String tenantId = org.getTenantId();

            // Ha valamiért üres lenne a tenantId (pl. hibás rekord), akkor átugorjuk
            if (tenantId == null || tenantId.trim().isEmpty()) {
                continue;
            }

            try {
                // A te setCurrentTenant metódusodat használjuk!
                TenantContext.setCurrentTenant(tenantId);

                // Lefuttatjuk az SQL-t a tenant adatbázisban
                jdbcTemplate.execute(createTableSql);

                System.out.println("✅ Documents tábla ellenőrizve a tenantban: " + tenantId);
            } catch (Exception e) {
                System.err.println("❌ Hiba a tenant frissítésekor (" + tenantId + "): " + e.getMessage());
            } finally {
                // Mindig kitakarítjuk a contextet a ciklus végén!
                TenantContext.clear();
            }
        }

        System.out.println("🚀 Tenant sémák frissítése befejeződött!");
    }
}