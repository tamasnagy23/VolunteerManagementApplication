package com.example.volunteermanagement.service;

import com.example.volunteermanagement.config.DataSourceConfig;
import com.example.volunteermanagement.model.Organization;
import com.example.volunteermanagement.model.OrganizationMember;
import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.orm.jpa.EntityManagerFactoryBuilder;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.HashMap;
import java.util.Map;

@Service
public class TenantProvisioningService {

    @Autowired
    private DataSourceConfig dataSourceConfig;

    @Autowired
    private EntityManagerFactoryBuilder entityManagerFactoryBuilder;

    @Autowired
    private UserRepository userRepository;

    public void createNewTenantDatabase(String tenantId, String dbName, Organization org, User admin, OrganizationMember member) {
        // 1. Létrehozzuk az adatbázist
        try (Connection connection = DriverManager.getConnection("jdbc:postgresql://localhost:5432/master_db", "postgres", "jelszo");
             Statement statement = connection.createStatement()) {
            statement.execute("CREATE DATABASE " + dbName);
            System.out.println("✅ Új bérlői adatbázis létrehozva: " + dbName);
        } catch (Exception e) {
            System.err.println("Hiba adatbázis létrehozásakor: " + e.getMessage());
        }

        // 2. Bejegyezzük a memóriába
        dataSourceConfig.addTenantDataSource(tenantId, dbName);
        DataSource newTenantDataSource = dataSourceConfig.getDataSourceForTenant(tenantId);

        // 3. Séma generálás
        Map<String, Object> properties = new HashMap<>();
        properties.put("hibernate.hbm2ddl.auto", "update");
        properties.put("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect");
        properties.put("hibernate.physical_naming_strategy", "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy");

        LocalContainerEntityManagerFactoryBean emfBean = entityManagerFactoryBuilder
                .dataSource(newTenantDataSource)
                .packages("com.example.volunteermanagement.model")
                .properties(properties)
                .build();

        emfBean.afterPropertiesSet();

        // 4. Kezdeti adatok (Org, Admin, SysAdmin) másolása
        syncUserToTenantDatabase(dbName, admin, org, member);

        User sysAdmin = userRepository.findByEmail("sysadmin@test.com").orElse(null);
        if (sysAdmin != null && !sysAdmin.getEmail().equals(admin.getEmail())) {
            // SysAdmin-nak nincs tagsága, csak a júzert másoljuk be
            copyUserOnly(dbName, sysAdmin);
        }

        if (emfBean.getObject() != null) emfBean.getObject().close();
    }

    // --- ÚJ: Ez a metódus másol át egy új tagot a szigetre ---
    public void syncUserToTenantDatabase(String dbName, User user, Organization org, OrganizationMember member) {
        String url = "jdbc:postgresql://localhost:5432/" + dbName;
        try (Connection conn = DriverManager.getConnection(url, "postgres", "jelszo")) {

            // 1. Felhasználó beszúrása (vagy frissítése, ha már ott lenne)
            String userSql = "INSERT INTO users (id, email, name, password, role) VALUES (?, ?, ?, ?, ?) " +
                    "ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role";
            try (PreparedStatement ps = conn.prepareStatement(userSql)) {
                ps.setLong(1, user.getId());
                ps.setString(2, user.getEmail());
                ps.setString(3, user.getName());
                ps.setString(4, user.getPassword());
                ps.setString(5, user.getRole().name());
                ps.executeUpdate();
            }

            // 2. Szervezet beszúrása (ha véletlen még nem lenne ott)
            String orgSql = "INSERT INTO organizations (id, name, tenant_id) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING";
            try (PreparedStatement ps = conn.prepareStatement(orgSql)) {
                ps.setLong(1, org.getId());
                ps.setString(2, org.getName());
                ps.setString(3, org.getTenantId());
                ps.executeUpdate();
            }

            // 3. Tagság beszúrása
            String memSql = "INSERT INTO organization_members (id, organization_id, user_id, role, status) VALUES (?, ?, ?, ?, ?) " +
                    "ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status";
            try (PreparedStatement ps = conn.prepareStatement(memSql)) {
                ps.setLong(1, member.getId());
                ps.setLong(2, org.getId());
                ps.setLong(3, user.getId());
                ps.setString(4, member.getRole().name());
                ps.setString(5, member.getStatus().name());
                ps.executeUpdate();
            }
            System.out.println("✅ Felhasználó (" + user.getEmail() + ") szinkronizálva a(z) " + dbName + " adatbázisba.");
        } catch (Exception e) {
            System.err.println("⚠️ Hiba a szinkronizáció során: " + e.getMessage());
        }
    }

    private void copyUserOnly(String dbName, User user) {
        String url = "jdbc:postgresql://localhost:5432/" + dbName;
        try (Connection conn = DriverManager.getConnection(url, "postgres", "jelszo")) {
            String sql = "INSERT INTO users (id, email, name, password, role) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setLong(1, user.getId());
                ps.setString(2, user.getEmail());
                ps.setString(3, user.getName());
                ps.setString(4, user.getPassword());
                ps.setString(5, user.getRole().name());
                ps.executeUpdate();
            }
        } catch (Exception e) {
            System.err.println("⚠️ Hiba a SysAdmin másolásakor: " + e.getMessage());
        }
    }
}