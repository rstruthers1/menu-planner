package com.menuplanner.service;

import com.menuplanner.domain.Meal;
import com.menuplanner.domain.MenuEntry;
import com.menuplanner.repository.MealRepository;
import com.menuplanner.repository.MenuEntryRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class MenuEntryService {

    private final MenuEntryRepository repository;
    private final MealRepository mealRepository;

    public MenuEntryService(MenuEntryRepository repository, MealRepository mealRepository) {
        this.repository = repository;
        this.mealRepository = mealRepository;
    }

    public List<MenuEntry> getAllMenus() {
        return repository.findAll();
    }

    public MenuEntry saveMenu(MenuEntry entry) {
        return repository.save(entry);
    }

    public List<MenuEntry> getMenusForWeek(LocalDate start, LocalDate end) {
        return repository.findByMealDateBetween(start, end);
    }

    public MenuEntry updateMenu(Long id, MenuEntry updated) {
        MenuEntry existing = repository.findById(id).orElseThrow();
        existing.setMeal(updated.getMeal());
        existing.setConfirmed(updated.getConfirmed());
        existing.setLeftover(updated.getLeftover());
        existing.setLeftoverFromDate(updated.getLeftoverFromDate());
        return repository.save(existing);
    }

    public MenuEntry setConfirmed(Long id, boolean confirmed) {
        MenuEntry existing = repository.findById(id).orElseThrow();
        existing.setConfirmed(confirmed);
        return repository.save(existing);
    }

    public List<MenuEntry> getPastMeals() {
        return repository.findByMealDateLessThanEqualOrderByMealDateDesc(LocalDate.now());
    }

    public void deleteMenu(Long id) {
        repository.deleteById(id);
    }

    public List<String> getMealNames() {
        return mealRepository.findAllNamesOrdered();
    }

    public Meal findOrCreateMeal(String name, String recipeLink, String notes) {
        if (name == null || name.isBlank()) return null;
        return mealRepository.findByName(name.trim()).orElseGet(() -> {
            Meal m = new Meal();
            m.setName(name.trim());
            m.setRecipeLink(recipeLink);
            m.setNotes(notes);
            return mealRepository.save(m);
        });
    }
}
