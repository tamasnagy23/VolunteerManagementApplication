package com.example.volunteermanagement.model;

public enum ShiftType {
    WORK,       // Sima munkaműszak (Szervező hozza létre, területhez kötött)
    MEETING,    // Gyűlés/Eligazítás (Szervező hozza létre, lehet Globális is)
    PERSONAL    // Személyes elfoglaltság (Önkéntes hozza létre, hogy lássa a szervező)
}