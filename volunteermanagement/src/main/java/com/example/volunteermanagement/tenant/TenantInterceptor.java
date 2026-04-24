package com.example.volunteermanagement.tenant;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@Slf4j
public class TenantInterceptor implements HandlerInterceptor {

    private static final String TENANT_HEADER = "X-Tenant-ID";
    private static final String DEFAULT_TENANT = "master"; // A központi adatbázis neve/azonosítója

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String tenantId = request.getHeader(TENANT_HEADER);

        if (tenantId != null && !tenantId.trim().isEmpty()) {
            TenantContext.setCurrentTenant(tenantId);
            log.debug("Tenant azonosítva a kérésben: {}", tenantId);
        } else {
            // Ha nincs fejléc, akkor alapértelmezetten a "master" (központi) adatbázist használjuk
            TenantContext.setCurrentTenant(DEFAULT_TENANT);
            log.debug("Nincs Tenant fejléc, átirányítás a master adatbázisra.");
        }

        return true; // Továbbengedjük a kérést a Controllernek
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        // NAGYON FONTOS: A Spring/Tomcat újrahasznosítja a szálakat (Thread Pool).
        // Ha ezt nem töröljük a kérés végén, a következő felhasználó megkaphatja az előző ember Tenant ID-ját!
        TenantContext.clear();
    }
}