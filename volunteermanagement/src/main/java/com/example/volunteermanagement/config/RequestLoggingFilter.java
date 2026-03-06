package com.example.volunteermanagement.config;

import com.example.volunteermanagement.service.AuditLogService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class RequestLoggingFilter extends OncePerRequestFilter {

    private final AuditLogService auditLogService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String method = request.getMethod();
        String uri = request.getRequestURI();

        if ("GET".equals(method) && uri.startsWith("/api/") && !uri.contains("/audit-logs")
                && !uri.contains("v3/api-docs") && !uri.contains("swagger-ui")) {

            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String userEmail = "Vendég";

            if (auth != null && auth.isAuthenticated() && !auth.getName().equals("anonymousUser")) {
                userEmail = auth.getName();
            }

            String actionName = "VIEW_DATA";
            if (uri.contains("/events")) actionName = "VIEW_EVENTS";
            else if (uri.contains("/organizations")) actionName = "VIEW_ORGANIZATIONS";
            else if (uri.contains("/team")) actionName = "VIEW_TEAM";
            else if (uri.contains("/users/me")) actionName = "VIEW_PROFILE";

            String details = "A felhasználó lekérte az adatokat innen: " + uri;

            try {
                // Átadjuk a munkát a biztonságos Service-nek!
                auditLogService.logAccess(userEmail, actionName, details, uri);
            } catch (Exception e) {
                // Ha a naplózás valamiért elszáll, CSAK a konzolra írjuk ki, NE dobjuk ki a felhasználót!
                System.err.println("Forgalmi napló mentési hiba: " + e.getMessage());
            }
        }

        // Továbbengedjük a kérést az eredeti céljához
        filterChain.doFilter(request, response);
    }
}