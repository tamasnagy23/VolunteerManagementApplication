package com.example.volunteermanagement.model;

public enum EventPermission {
    MANAGE_APPLICATIONS, // Elbírálhat jelentkezőket
    MANAGE_SHIFTS,       // Létrehozhat/törölhet műszakokat
    ASSIGN_VOLUNTEERS,   // Beoszthat embereket a műszakokba
    EDIT_EVENT_DETAILS   // Módosíthatja az esemény nevét/dátumát
}