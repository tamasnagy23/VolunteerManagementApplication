package com.example.volunteermanagement.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "meal_consumption_log")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MealConsumptionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Aki kapja az ételt (az önkéntes)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "volunteer_id", nullable = false)
    private User volunteer;

    // Melyik fesztiválon történt a fogyasztás (későbbi statisztikákhoz hasznos)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    // A büfés/szervező, aki leolvasta a QR kódot (biztonsági audit napló)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scanned_by_id", nullable = false)
    private User scannedBy;

    // --- ÚJ MEZŐ: A kiadott étkezés típusa (Reggeli, Ebéd, Vacsora) ---
    @Enumerated(EnumType.STRING)
    @Column(name = "meal_type", nullable = false)
    private MealType mealType;

    // A pontos időbélyeg, amikor a tranzakció történt
    @Column(nullable = false)
    private LocalDateTime consumedAt;

    // Ezt a kiadás pillanatában "lefényképezzük" a kérdőívből,
    // hogy meglegyen naplózva, milyen ételt (pl. Vegán) adtunk ki.
    private String dietaryPreference;
}