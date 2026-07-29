package com.example.volunteermanagement.service;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileStorageService {

    // Ide mentjük a képeket a projekted gyökérmappájába
    private final String uploadDir = "uploads";

    // --- 1. A TE EREDETI METÓDUSOD (Érintetlenül hagyva az eddigi funkciókhoz) ---
    public String storeFile(MultipartFile file, String subFolder) {
        try {
            if (file == null || file.isEmpty()) {
                throw new RuntimeException("Üres fájlt nem lehet feltölteni.");
            }

            Path targetDirectory = Paths.get(uploadDir, subFolder);

            if (!Files.exists(targetDirectory)) {
                Files.createDirectories(targetDirectory);
            }

            String originalFilename = StringUtils.cleanPath(file.getOriginalFilename() != null ? file.getOriginalFilename() : "");
            String extension = originalFilename.contains(".") ? originalFilename.substring(originalFilename.lastIndexOf(".")) : "";
            String newFilename = UUID.randomUUID().toString() + extension;

            Path targetLocation = targetDirectory.resolve(newFilename);
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);

            return "/uploads/" + subFolder + "/" + newFilename;

        } catch (IOException ex) {
            throw new RuntimeException("Hiba a fájl mentésekor a '" + subFolder + "' mappába: " + ex.getMessage(), ex);
        }
    }

    // --- 2. AZ ÚJ METÓDUS (A DocumentService számára, ami 3 paramétert vár) ---
    public String storeFile(MultipartFile file, String storedFileName, String subFolder) {
        try {
            if (file == null || file.isEmpty()) {
                throw new RuntimeException("Üres fájlt nem lehet feltölteni.");
            }

            Path targetDirectory = Paths.get(uploadDir, subFolder);

            if (!Files.exists(targetDirectory)) {
                Files.createDirectories(targetDirectory);
            }

            // Itt a paraméterben kapott storedFileName-t használjuk a UUID generálás helyett
            Path targetLocation = targetDirectory.resolve(storedFileName);
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);

            return "/uploads/" + subFolder + "/" + storedFileName;

        } catch (IOException ex) {
            throw new RuntimeException("Hiba a fájl mentésekor a '" + subFolder + "' mappába: " + ex.getMessage(), ex);
        }
    }

    // --- 3. FÁJL BETÖLTÉSE (A te eredeti kódod, érintetlenül) ---
    public org.springframework.core.io.Resource loadFileAsResource(String relativePath) {
        try {
            String cleanPath = relativePath.startsWith("/") ? relativePath.substring(1) : relativePath;
            Path filePath = Paths.get(cleanPath).normalize();

            org.springframework.core.io.Resource resource = new org.springframework.core.io.UrlResource(filePath.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new RuntimeException("A fájl nem található vagy nem olvasható: " + relativePath);
            }
        } catch (Exception ex) {
            throw new RuntimeException("Hiba a fájl betöltésekor: " + relativePath, ex);
        }
    }

    // --- 4. FÁJL TÖRLÉSE (A te eredeti kódod, érintetlenül) ---
    public void deleteFile(String relativePath) {
        try {
            if (relativePath == null || relativePath.isEmpty()) return;

            String cleanPath = relativePath.startsWith("/") ? relativePath.substring(1) : relativePath;
            Path filePath = Paths.get(cleanPath).normalize();
            Files.deleteIfExists(filePath);
        } catch (IOException ex) {
            throw new RuntimeException("Nem sikerült törölni a fájlt: " + relativePath, ex);
        }
    }
}