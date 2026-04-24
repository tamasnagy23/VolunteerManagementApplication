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

    // A konstruktort ki is törölhetjük, mert a mentésnél dinamikusan kezeljük a mappákat!

    public String storeFile(MultipartFile file, String subFolder) {
        try {
            if (file == null || file.isEmpty()) {
                throw new RuntimeException("Üres fájlt nem lehet feltölteni.");
            }

            // 1. Cél mappa elérési útjának összeállítása (pl. uploads/announcements)
            Path targetDirectory = Paths.get(uploadDir, subFolder);

            // 2. DINAMIKUS MAPPA LÉTREHOZÁS: Ha nem létezik a mappa, most létrehozzuk!
            if (!Files.exists(targetDirectory)) {
                Files.createDirectories(targetDirectory);
            }

            // 3. Eredeti fájlnév és kiterjesztés kinyerése (pl. .png, .jpg)
            String originalFilename = StringUtils.cleanPath(file.getOriginalFilename() != null ? file.getOriginalFilename() : "");
            String extension = originalFilename.contains(".") ? originalFilename.substring(originalFilename.lastIndexOf(".")) : "";

            // 4. Generálunk egy egyedi nevet, pl: 550e8400-e29b-41d4-a716-446655440000.png
            String newFilename = UUID.randomUUID().toString() + extension;

            // 5. Cél útvonal összeállítása a fájlnak
            Path targetLocation = targetDirectory.resolve(newFilename);

            // 6. Fájl másolása a mappába
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);

            // Visszaadjuk a relatív URL-t a React számára
            return "/uploads/" + subFolder + "/" + newFilename;

        } catch (IOException ex) {
            // Részletesebb hibaüzenet, hogy legközelebb pontosan lássuk, hol akadt el
            throw new RuntimeException("Hiba a fájl mentésekor a '" + subFolder + "' mappába: " + ex.getMessage(), ex);
        }
    }
}