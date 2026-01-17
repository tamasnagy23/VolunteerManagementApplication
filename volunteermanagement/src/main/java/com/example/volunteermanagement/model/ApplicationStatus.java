// ApplicationStatus.java (model csomag)
package com.example.volunteermanagement.model;

public enum ApplicationStatus {
    PENDING,    // Jelentkezett, elbírálásra vár
    APPROVED,   // Elfogadva (Most már be lehet osztani műszakba)
    REJECTED    // Elutasítva
}