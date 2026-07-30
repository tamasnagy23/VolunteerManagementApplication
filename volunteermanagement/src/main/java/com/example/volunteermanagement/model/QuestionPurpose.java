package com.example.volunteermanagement.model;

public enum QuestionPurpose {
    GENERAL,              // Sima kérdés, nincs rendszerbeli extra funkciója
    TSHIRT_SIZE,          // Pólóméret (készlet/raktár modulhoz)
    DIETARY_PREFERENCE,   // Étkezési igény (QR kódos büfé modulhoz)
    MEDICAL_INFO          // Esetleg később: egészségügyi infó (pl. allergia, amit ki kell emelni)
}