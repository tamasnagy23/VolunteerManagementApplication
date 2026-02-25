package com.example.volunteermanagement.dto;

import com.example.volunteermanagement.model.Gender;
import jakarta.validation.constraints.*;

import java.time.LocalDate;

public record RegisterRequest(
        @NotBlank(message = "A név nem lehet üres")
        String name,

        @NotBlank(message = "Az email nem lehet üres")
        @Email(message = "Nem érvényes email formátum")
        String email,

        @NotBlank(message = "A jelszó nem lehet üres")
        @Size(min = 6, message = "A jelszó legyen legalább 6 karakter")
        String password,

        @NotBlank(message = "A telefonszám megadása kötelező")
        String phoneNumber,

        @NotNull(message = "A nem megadása kötelező")
        Gender gender,

        @NotNull(message = "A születési dátum megadása kötelező")
        @Past(message = "A születési dátum csak múltbeli lehet")
        LocalDate dateOfBirth,

        // A @AssertTrue garantálja, hogy a kérés elbukik, ha a checkbox nincs bepipálva (azaz az értéke false)
        @AssertTrue(message = "Az Adatvédelmi Tájékoztató (GDPR) elfogadása kötelező a regisztrációhoz")
        boolean acceptGdpr,

        @AssertTrue(message = "Az Általános Szerződési Feltételek (ÁSZF) elfogadása kötelező a regisztrációhoz")
        boolean acceptTerms
) {}