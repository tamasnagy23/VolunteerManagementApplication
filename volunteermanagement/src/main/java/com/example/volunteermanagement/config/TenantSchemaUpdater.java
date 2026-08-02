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

        System.out.println("⏳ Adatbázis sémák automatikus ellenőrzése és frissítése...");

        // 1. MESTER ADATBÁZIS FRISSÍTÉSE
        System.out.println("--> MESTER adatbázis frissítése...");
        try {
            TenantContext.setCurrentTenant(null); // A Mester adatbázisra mutat
            applyDatabaseUpdates();
            System.out.println("✅ Séma frissítve a Mester adatbázisban.");
        } catch (Exception e) {
            System.err.println("❌ Hiba a Mester adatbázis frissítésekor: " + e.getMessage());
        }

        // 2. TENANT ADATBÁZISOK FRISSÍTÉSE
        for (Organization org : organizations) {
            String tenantId = org.getTenantId();

            if (tenantId == null || tenantId.trim().isEmpty()) {
                continue;
            }

            try {
                System.out.println("--> TENANT frissítése: " + tenantId);
                TenantContext.setCurrentTenant(tenantId);
                applyDatabaseUpdates();
                System.out.println("✅ Séma frissítve a tenantban: " + tenantId);
            } catch (Exception e) {
                System.err.println("❌ Hiba a tenant frissítésekor (" + tenantId + "): " + e.getMessage());
            } finally {
                TenantContext.clear();
            }
        }

        System.out.println("🚀 Minden adatbázis séma frissítése sikeresen befejeződött!");
    }

    /**
     * Ez a metódus tartalmazza az összes sémamódosítást.
     * Mindig biztonságos, "IF NOT EXISTS" jellegű műveleteket használj itt!
     */
    private void applyDatabaseUpdates() {
        // 1. Táblák létrehozása
        createTables();

        // 2. Új oszlopok dinamikus hozzáadása
        // Ezentúl csak ide kell beírnod egy új sort, ha bővíted az Entity-t!

        // --- Az új étkezési idősávok bevezetése az Eseményekhez ---
        addColumnIfNotExists("events", "breakfast_start_time", "TIME");
        addColumnIfNotExists("events", "breakfast_end_time", "TIME");
        addColumnIfNotExists("events", "lunch_start_time", "TIME");
        addColumnIfNotExists("events", "lunch_end_time", "TIME");
        addColumnIfNotExists("events", "dinner_start_time", "TIME");
        addColumnIfNotExists("events", "dinner_end_time", "TIME");

        // 3. Egyéb frissítések (pl. Constraint-ek)
        executeSqlSafely("ALTER TABLE event_team_members DROP CONSTRAINT IF EXISTS event_team_members_role_check;");
        executeSqlSafely("ALTER TABLE event_team_members ADD CONSTRAINT event_team_members_role_check CHECK (role IN ('ORGANIZER', 'COORDINATOR', 'MEAL_SCANNER'));");
    }

    private void createTables() {
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

        executeSqlSafely(createTableSql);
        executeSqlSafely(createMealLogTableSql);
    }

    /**
     * Okos metódus: Csak akkor adja hozzá az oszlopot, ha az még nem létezik.
     */
    private void addColumnIfNotExists(String tableName, String columnName, String dataType) {
        try {
            // PostgreSQL information_schema lekérdezése az oszlop létezésének ellenőrzésére
            String checkSql = "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = ? AND column_name = ?";
            Integer count = jdbcTemplate.queryForObject(checkSql, Integer.class, tableName, columnName);

            if (count != null && count == 0) {
                String alterSql = "ALTER TABLE " + tableName + " ADD COLUMN " + columnName + " " + dataType;
                jdbcTemplate.execute(alterSql);
                System.out.println("  [+] Új oszlop hozzáadva: " + tableName + "." + columnName);
            }
        } catch (Exception e) {
            System.err.println("  [!] Nem sikerült ellenőrizni/hozzáadni az oszlopot (" + tableName + "." + columnName + "): " + e.getMessage());
        }
    }

    /**
     * Segédmetódus a biztonságos SQL futtatáshoz, amely elnyeli és logolja a hibákat.
     */
    private void executeSqlSafely(String sql) {
        try {
            jdbcTemplate.execute(sql);
        } catch (Exception e) {
            System.err.println("  [!] SQL végrehajtási hiba: " + e.getMessage());
        }
    }
}