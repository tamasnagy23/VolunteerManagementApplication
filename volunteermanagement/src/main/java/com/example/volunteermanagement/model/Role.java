package com.example.volunteermanagement.model;

public enum Role {
    SYS_ADMIN,    // Rendszergazda (Mindent lát, minden szervezet felett áll)
    ORGANIZER,    // Szervező (Egy szervezet vezetője)
    COORDINATOR,  // Koordinátor (Műszakokat kezel)
    VOLUNTEER     // Önkéntes (Csak jelentkezik)
}