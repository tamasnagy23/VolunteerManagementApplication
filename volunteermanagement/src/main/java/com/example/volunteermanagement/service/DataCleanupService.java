package com.example.volunteermanagement.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class DataCleanupService {

    private final JdbcTemplate jdbcTemplate;

    // Cron kifejezés: Minden éjjel 02:00-kor lefut
    @Scheduled(cron = "0 0 2 * * ?")
    @Transactional
    public void cleanupOldDeletedData() {
        log.info("🧹 Szemétszállító robot elindult: 30 napnál régebbi adatok végleges törlése...");

        // 1. FELHASZNÁLÓK VÉGLEGES TÖRLÉSE (Master DB)
        int deletedUsers = jdbcTemplate.update(
                "DELETE FROM users WHERE deleted_at < CURRENT_TIMESTAMP - INTERVAL '30 days'"
        );
        if (deletedUsers > 0) log.info("🗑️ Véglegesen törölt felhasználók: {}", deletedUsers);

        // 2. ESEMÉNYEK VÉGLEGES TÖRLÉSE A MESTER KIRAKATÁBÓL
        int deletedEvents = jdbcTemplate.update(
                "DELETE FROM events WHERE deleted_at < CURRENT_TIMESTAMP - INTERVAL '30 days'"
        );
        if (deletedEvents > 0) log.info("🗑️ Véglegesen törölt események (Kirakat): {}", deletedEvents);

        // 3. ESEMÉNYEK VÉGLEGES TÖRLÉSE AZ ÉLŐ SZIGETEKEN IS
        List<String> activeTenants = jdbcTemplate.queryForList(
                "SELECT tenant_id FROM organizations WHERE deleted_at IS NULL AND tenant_id IS NOT NULL",
                String.class
        );
        for (String tenant : activeTenants) {
            cleanUpTenantDatabaseEvents(tenant + "_db");
        }

        // 4. MEGSZŰNT SZERVEZETEK ÉS SZIGETEK VÉGLEGES TÖRLÉSE
        List<Map<String, Object>> oldOrgs = jdbcTemplate.queryForList(
                "SELECT id, name, tenant_id FROM organizations WHERE deleted_at < CURRENT_TIMESTAMP - INTERVAL '30 days'"
        );

        for (Map<String, Object> org : oldOrgs) {
            Long orgId = ((Number) org.get("id")).longValue();
            String tenantId = (String) org.get("tenant_id");
            String dbName = tenantId + "_db";

            log.warn("⚠️ SZERVEZET VÉGLEGES TÖRLÉSE INDUL: {} (Adatbázis: {})", org.get("name"), dbName);

            // A) Sziget felrobbantása (Drop Database)
            dropTenantDatabase(dbName);

            // B) Szervezet törlése a Mesterből
            jdbcTemplate.update("DELETE FROM organizations WHERE id = ?", orgId);
            log.info("✅ Szervezet eltávolítva a Mester adatbázisból is: {}", orgId);
        }

        log.info("🏁 Szemétszállító robot befejezte a munkát.");
    }

    private void cleanUpTenantDatabaseEvents(String dbName) {
        try (Connection conn = DriverManager.getConnection("jdbc:postgresql://localhost:5432/" + dbName, "postgres", "jelszo");
             Statement stmt = conn.createStatement()) {
            int deleted = stmt.executeUpdate("DELETE FROM events WHERE deleted_at < CURRENT_TIMESTAMP - INTERVAL '30 days'");
            if (deleted > 0) {
                log.info("🧹 {} szigeten véglegesen törölve {} lejárt esemény.", dbName, deleted);
            }
        } catch (Exception e) {
            log.error("⚠️ Nem sikerült takarítani a(z) {} szigeten: {}", dbName, e.getMessage());
        }
    }

    private void dropTenantDatabase(String dbName) {
        try (Connection connection = DriverManager.getConnection("jdbc:postgresql://localhost:5432/master_db", "postgres", "jelszo");
             Statement statement = connection.createStatement()) {

            // Hogy biztosan ki lehessen törölni a szigetet, erőszakkal kiléptetünk mindenkit (nyitott kapcsolatok lezárása)
            statement.execute("SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '" + dbName + "' AND pid <> pg_backend_pid()");

            // Adatbázis megsemmisítése
            statement.execute("DROP DATABASE IF EXISTS " + dbName);
            log.info("💥 Bérlői adatbázis (Sziget) sikeresen megsemmisítve: {}", dbName);

        } catch (Exception e) {
            log.error("❌ Hiba az adatbázis törlésekor ({}): {}", dbName, e.getMessage());
        }
    }
}