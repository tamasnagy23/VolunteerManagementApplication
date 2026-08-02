package com.example.volunteermanagement.model;

public enum EventPermission {
    MANAGE_APPLICATIONS,    // Elbírálhat jelentkezőket
    MANAGE_SHIFTS,          // Létrehozhat/törölhet műszakokat
    ASSIGN_VOLUNTEERS,      // Beoszthat embereket a műszakokba
    EDIT_EVENT_DETAILS,     // Módosíthatja az esemény nevét/dátumát

    // --- ÚJ CATERING JOGOSULTSÁGOK ---
    MANAGE_CATERING_LOCAL,  // Csak a saját kezelt területein lévőket látja és módosíthatja
    MANAGE_CATERING_GLOBAL  // Konyhafőnök mód: mindenkit lát és módosíthat az eseményen
}