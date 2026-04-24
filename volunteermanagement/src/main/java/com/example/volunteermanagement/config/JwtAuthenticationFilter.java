package com.example.volunteermanagement.config;

import com.example.volunteermanagement.tenant.TenantContext;
import io.jsonwebtoken.ExpiredJwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        final String authHeader = request.getHeader("Authorization");
        final String jwt;
        final String userEmail;

        // Ha nincs token, menjünk tovább a láncban
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            jwt = authHeader.substring(7);
            userEmail = jwtService.extractUsername(jwt);

            if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {

                // --- A TRÜKK: Multi-Tenant Biztonsági Híd ---
                // Eltároljuk az épp aktuális értéket (ha van)
                String currentTenant = TenantContext.getCurrentTenant();

                // Kényszerítjük a rendszert, hogy a felhasználót a master_db-ben keresse
                TenantContext.setCurrentTenant(null);

                UserDetails userDetails = this.userDetailsService.loadUserByUsername(userEmail);

                // Ha megvan a felhasználó, visszaállítjuk az eredeti adatbázist
                TenantContext.setCurrentTenant(currentTenant);

                if (jwtService.isTokenValid(jwt, userDetails)) {
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities()
                    );
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }

            // Ha minden sikeresen lefutott, engedjük tovább a kérést
            filterChain.doFilter(request, response);

        } catch (ExpiredJwtException e) {
            // Biztonsági takarítás hiba esetén is
            TenantContext.clear();
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"error\": \"A munkamenet lejárt, kérlek jelentkezz be újra!\"}");
        } catch (Exception e) {
            TenantContext.clear();
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"error\": \"Érvénytelen token!\"}");
        }
    }
}