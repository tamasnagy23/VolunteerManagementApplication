package com.example.volunteermanagement.tenant;

import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;

public class TenantRoutingDataSource extends AbstractRoutingDataSource {

    @Override
    protected Object determineCurrentLookupKey() {
        // Itt mondjuk meg a Springnek, hogy mi az aktuális Tenant ID,
        // amit a TenantInterceptor az előbb beállított!
        return TenantContext.getCurrentTenant();
    }
}