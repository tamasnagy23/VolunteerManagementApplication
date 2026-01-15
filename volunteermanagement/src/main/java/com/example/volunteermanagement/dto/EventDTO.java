package com.example.volunteermanagement.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull; // Fontos!
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;

public record EventDTO(
        @NotBlank(message = "Az esemény címe nem lehet üres")
        @Size(min = 3, max = 100, message = "A cím 3 és 100 karakter között legyen")
        String title,

        @NotBlank(message = "A leírás kötelező")
        String description,

        @NotBlank(message = "A helyszín kötelező")
        String location,

        // --- ÚJ MEZŐK ---
        @NotNull(message = "A kezdés ideje kötelező")
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        LocalDateTime startTime,

        @NotNull(message = "A befejezés ideje kötelező")
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        LocalDateTime endTime,
        // ----------------

        // Levettük a @NotEmpty-t, így lehet üres a lista (opcionális)
        @Valid
        List<ShiftDTO> shifts
) {}