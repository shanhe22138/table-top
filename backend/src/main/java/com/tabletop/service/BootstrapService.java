package com.tabletop.service;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class BootstrapService implements ApplicationRunner {
    private final LegacyMigrationService legacyMigrationService;
    private final SettingsService settingsService;

    public BootstrapService(LegacyMigrationService legacyMigrationService, SettingsService settingsService) {
        this.legacyMigrationService = legacyMigrationService;
        this.settingsService = settingsService;
    }

    @Override
    public void run(ApplicationArguments args) {
        legacyMigrationService.importIfConfigured();
        settingsService.ensureDefaults();
    }
}
