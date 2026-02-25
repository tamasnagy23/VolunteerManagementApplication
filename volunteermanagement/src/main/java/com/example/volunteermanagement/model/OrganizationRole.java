package com.example.volunteermanagement.model;

public enum OrganizationRole {
    OWNER,       // Ő regisztrálta a céget, mindent lát és módosíthat
    ORGANIZER,   // Eseményeket hozhat létre, koordinátorokat vehet fel
    COORDINATOR, // Műszakokat kezelhet, embereket oszthat be
    VOLUNTEER    // Sima önkéntes a szervezetnél
}