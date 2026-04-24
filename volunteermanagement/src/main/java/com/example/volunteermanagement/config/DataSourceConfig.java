package com.example.volunteermanagement.config;

import com.example.volunteermanagement.tenant.TenantRoutingDataSource;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Configuration
public class DataSourceConfig {

    private final Map<Object, Object> targetDataSources = new ConcurrentHashMap<>();
    private TenantRoutingDataSource tenantRoutingDataSource;

    @Bean
    @Primary
    public DataSource dataSource() {
        tenantRoutingDataSource = new TenantRoutingDataSource();

        // 1. A MASTER (Központi) adatbázis inicializálása
        DataSource masterDb = createDataSource("jdbc:postgresql://localhost:5432/master_db", "postgres", "jelszo");
        targetDataSources.put("master", masterDb);

        // 2. ÚJ: Automatikus Bérlő (Tenant) betöltés a Mesterből!
        loadTenantsFromMaster(masterDb);

        // 3. Konfiguráljuk a liftet
        tenantRoutingDataSource.setDefaultTargetDataSource(masterDb);
        tenantRoutingDataSource.setTargetDataSources(targetDataSources);
        tenantRoutingDataSource.afterPropertiesSet();

        return tenantRoutingDataSource;
    }

    // --- ÚJ: Ez olvassa ki induláskor az összes létező adatbázist ---
    private void loadTenantsFromMaster(DataSource masterDb) {
        System.out.println("🔄 Bérlői (Tenant) adatbázisok keresése a Mesterben...");
        try (Connection conn = masterDb.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT tenant_id FROM organizations WHERE tenant_id IS NOT NULL")) {

            while (rs.next()) {
                String tenantId = rs.getString("tenant_id");
                if (tenantId != null && !tenantId.trim().isEmpty()) {
                    String dbName = tenantId + "_db";
                    DataSource tenantDb = createDataSource("jdbc:postgresql://localhost:5432/" + dbName, "postgres", "jelszo");
                    targetDataSources.put(tenantId, tenantDb);
                    System.out.println("✅ Liftbe bekötve: " + tenantId + " -> " + dbName);
                }
            }
        } catch (Exception e) {
            System.out.println("⚠️ Figyelem (Első indulás?): Nem sikerült kiolvasni a bérlőket. Oka: " + e.getMessage());
        }
    }

    // Dinamikus hozzáadás (Regisztrációkor az AuthService hívja)
    public void addTenantDataSource(String tenantId, String dbName) {
        String url = "jdbc:postgresql://localhost:5432/" + dbName;
        DataSource newDb = createDataSource(url, "postgres", "jelszo");

        targetDataSources.put(tenantId, newDb);
        tenantRoutingDataSource.setTargetDataSources(targetDataSources);
        tenantRoutingDataSource.afterPropertiesSet();
    }

    public DataSource getDataSourceForTenant(String tenantId) {
        return (DataSource) targetDataSources.get(tenantId);
    }

    // --- ÚJ METÓDUS: Hozzáférés a Mester adatbázishoz ---
    public DataSource getMasterDataSource() {
        return (DataSource) targetDataSources.get("master");
    }

    private DataSource createDataSource(String url, String username, String password) {
        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(url);
        dataSource.setUsername(username);
        dataSource.setPassword(password);
        dataSource.setDriverClassName("org.postgresql.Driver");
        return dataSource;
    }
}