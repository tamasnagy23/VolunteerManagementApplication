package com.example.volunteermanagement.config;

import com.example.volunteermanagement.tenant.TenantInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final TenantInterceptor tenantInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // JAVÍTÁS: A biztonsági őr (Interceptor) NEM vizsgálja a képeket és a publikus végpontokat!
        registry.addInterceptor(tenantInterceptor)
                .excludePathPatterns(
                        "/uploads/**",          // Képek
                        "/api/auth/**",         // Bejelentkezés/Regisztráció
                        "/api/events/public",   // Publikus eseményfal
                        "/swagger-ui/**",       // Dokumentáció
                        "/v3/api-docs/**"
                );
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*") // Pattern használata a biztonság kedvéért
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(false); // Képeknél ez fontos lehet
    }
}