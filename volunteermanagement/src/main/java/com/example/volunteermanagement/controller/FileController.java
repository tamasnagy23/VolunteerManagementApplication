package com.example.volunteermanagement.controller;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.file.Path;
import java.nio.file.Paths;

@RestController
public class FileController {

    @GetMapping("/uploads/**")
    public ResponseEntity<Resource> serveFile(HttpServletRequest request) {
        try {
            // Ez kiszedi a teljes útvonalat az /uploads/ után (pl: avatars/kep.jpg)
            String path = new AntPathMatcher().extractPathWithinPattern("/uploads/**", request.getRequestURI());

            Path filePath = Paths.get("uploads").resolve(path).normalize();
            Resource resource = new UrlResource(filePath.toUri());

            System.out.println("DEBUG: Kérés érkezett ide: " + request.getRequestURI());
            System.out.println("DEBUG: Keresett fájl: " + filePath.toAbsolutePath());

            if (resource.exists()) {
                return ResponseEntity.ok()
                        .contentType(MediaType.IMAGE_JPEG) // A böngésző okos, a legtöbb képet megeszi így
                        .body(resource);
            } else {
                System.out.println("DEBUG: A fájl NEM létezik a lemezen!");
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}