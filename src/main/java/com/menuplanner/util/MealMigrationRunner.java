package com.menuplanner.util;

import com.menuplanner.domain.Meal;
import com.menuplanner.repository.MealRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Runs once on first boot after the Meal table is added.
 * Reads the orphaned meal_name/recipe_link/notes columns from menu_entry
 * (which Hibernate leaves in place) and migrates them into the new meal table.
 */
@Component
@Order(1)
public class MealMigrationRunner implements CommandLineRunner {

    private final MealRepository mealRepository;
    private final JdbcTemplate jdbc;

    public MealMigrationRunner(MealRepository mealRepository, JdbcTemplate jdbc) {
        this.mealRepository = mealRepository;
        this.jdbc = jdbc;
    }

    @Override
    public void run(String... args) {
        Long menuCount = jdbc.queryForObject("SELECT COUNT(*) FROM menu_entry", Long.class);
        if (mealRepository.count() > 0 || menuCount == null || menuCount == 0) return;

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT DISTINCT meal_name, recipe_link, notes FROM menu_entry " +
                "WHERE meal_name IS NOT NULL AND meal_name <> '' ORDER BY meal_name"
        );

        for (Map<String, Object> row : rows) {
            Meal meal = new Meal();
            meal.setName((String) row.get("meal_name"));
            meal.setRecipeLink((String) row.get("recipe_link"));
            meal.setNotes((String) row.get("notes"));
            mealRepository.save(meal);
        }

        for (Meal meal : mealRepository.findAll()) {
            jdbc.update(
                "UPDATE menu_entry SET meal_id = ? WHERE meal_name = ?",
                meal.getId(), meal.getName()
            );
        }
    }
}
