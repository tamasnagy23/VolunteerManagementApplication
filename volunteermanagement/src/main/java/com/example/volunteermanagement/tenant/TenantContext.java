package com.example.volunteermanagement.tenant;

import lombok.extern.slf4j.Slf4j;

@Slf4j
public class TenantContext {

    // ThreadLocal garantálja, hogy minden párhuzamos HTTP kérés a saját azonosítóját látja
    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    public static void setCurrentTenant(String tenantId) {
        log.debug("Tenant beállítva az aktuális szálon: {}", tenantId);
        CURRENT_TENANT.set(tenantId);
    }

    public static String getCurrentTenant() {
        return CURRENT_TENANT.get();
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }
}