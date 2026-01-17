// WorkArea.java (model csomag)
package com.example.volunteermanagement.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
public class WorkArea {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name; // Pl. "Pult", "Kordon", "Infópult"
    private String description;

    @ManyToOne
    @JoinColumn(name = "event_id")
    private Event event; // Melyik eseményhez tartozik
}