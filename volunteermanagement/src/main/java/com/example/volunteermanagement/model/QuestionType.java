package com.example.volunteermanagement.model;

public enum QuestionType {
    TEXT,       // Sima szöveges válasz (pl. "Van-e ételallergiád?")
    DROPDOWN,   // Legördülő lista (pl. "Pólóméret: S, M, L, XL")
    CHECKBOX    // Több is választható (pl. "Melyik napokon érsz rá?")
}