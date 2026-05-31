package com.menuplanner.util;

import com.menuplanner.domain.AppUser;
import com.menuplanner.domain.Household;
import com.menuplanner.repository.AppUserRepository;
import com.menuplanner.repository.HouseholdRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(20)
public class HouseholdSeeder implements CommandLineRunner {

    private final HouseholdRepository householdRepository;
    private final AppUserRepository appUserRepository;
    private final JdbcTemplate jdbc;

    public HouseholdSeeder(HouseholdRepository householdRepository,
                           AppUserRepository appUserRepository,
                           JdbcTemplate jdbc) {
        this.householdRepository = householdRepository;
        this.appUserRepository = appUserRepository;
        this.jdbc = jdbc;
    }

    @Override
    public void run(String... args) {
        Household struthers = householdRepository.findByName("Struthers")
                .orElseGet(() -> {
                    Household h = new Household();
                    h.setName("Struthers");
                    return householdRepository.save(h);
                });

        if (!appUserRepository.existsByNameAndHousehold("Rachel", struthers)) {
            AppUser rachel = new AppUser();
            rachel.setName("Rachel");
            rachel.setHousehold(struthers);
            appUserRepository.save(rachel);
        }

        if (!appUserRepository.existsByNameAndHousehold("Joe", struthers)) {
            AppUser joe = new AppUser();
            joe.setName("Joe");
            joe.setHousehold(struthers);
            appUserRepository.save(joe);
        }

        // Assign all unowned menu entries to the Struthers household
        jdbc.update("UPDATE menu_entry SET household_id = ? WHERE household_id IS NULL", struthers.getId());

        // Ensure new meal columns exist — ddl-auto: update can fail on non-empty tables
        jdbc.execute("ALTER TABLE meal ADD COLUMN IF NOT EXISTS household_id bigint REFERENCES household(id)");
        jdbc.execute("ALTER TABLE meal ADD COLUMN IF NOT EXISTS shared boolean NOT NULL DEFAULT false");

        // Mark all unowned meals as shared (seeded from Excel — available to everyone)
        jdbc.update("UPDATE meal SET household_id = ?, shared = true WHERE household_id IS NULL", struthers.getId());

        // Drop global unique constraint on meal name — duplicate names across households are allowed
        jdbc.execute("ALTER TABLE meal DROP CONSTRAINT IF EXISTS meal_name_unique");
    }
}
