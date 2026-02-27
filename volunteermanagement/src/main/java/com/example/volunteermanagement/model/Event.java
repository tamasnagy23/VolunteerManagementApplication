package com.example.volunteermanagement.model;

import com.fasterxml.jackson.annotation.JsonFormat; // <--- EZT NE FELEJTSD EL!
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
@Table(name = "events")
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    @Column(columnDefinition = "TEXT")
    private String description;
    private String location;

    @ManyToOne
    @JoinColumn(name = "organization_id")
    @JsonIgnore // Hogy ne legyen körkörös hivatkozás
    private Organization organization;

    // Ez mondja meg a Javanak, hogyan olvassa be a "2026-06-01T10:00:00" szöveget
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime startTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime endTime;

    // -------------------------------------

    // Az eseményhez tartozó munkaterületek
    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    @JsonManagedReference
    private List<WorkArea> workAreas = new ArrayList<>();

    // Az eseményhez tartozó extra kérdések (kérdőív)
    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    @JsonManagedReference
    private List<EventQuestion> questions = new ArrayList<>();

    /*@OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Shift> shifts = new ArrayList<>();*/

    /*public void addShift(Shift shift) {
        shifts.add(shift);
        shift.setEvent(this);
    }*/
}