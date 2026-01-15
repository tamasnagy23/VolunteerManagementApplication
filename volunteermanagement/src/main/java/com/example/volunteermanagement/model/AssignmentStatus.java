package com.example.volunteermanagement.model;

public enum AssignmentStatus {
    PENDING,    // Alapállapot: A jelentkezés beérkezett, döntésre vár
    APPROVED,   // Elfogadva: Az önkéntes be van osztva a műszakra
    REJECTED,   // Elutasítva: Pl. betelt a hely, vagy nem felel meg a feltételeknek
    COMPLETED,  // Teljesítve: Az esemény lezajlott, az önkéntes megjelent és dolgozott
    CANCELED    // Lemondva: Ha az önkéntes visszavonja a jelentkezést (opcionális, de hasznos)
}