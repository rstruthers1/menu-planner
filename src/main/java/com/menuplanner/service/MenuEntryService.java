package com.menuplanner.service;

import com.menuplanner.domain.Household;
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

    public List<MenuEntry> getAllMenus(Household household) {
        return repository.findAllByHousehold(household);
    }

    public MenuEntry saveMenu(MenuEntry entry) {
        return repository.save(entry);
    }

    public List<MenuEntry> getMenusForWeek(LocalDate start, LocalDate end, Household household) {
        return repository.findByMealDateBetweenAndHousehold(start, end, household);
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

    public List<MenuEntry> getPastMeals(Household household) {
        return repository.findByMealDateLessThanEqualAndHouseholdOrderByMealDateDesc(LocalDate.now(), household);
    }

    public void deleteMenu(Long id) {
        repository.deleteById(id);
    }

    public List<String> getMealNames(Household household) {
        return mealRepository.findNamesForHousehold(household);
    }

    public Meal findOrCreateMeal(String name, String recipeLink, String notes, boolean shared, Household household) {
        if (name == null || name.isBlank()) return null;
        String trimmed = name.trim();

        // Existing meal in this household — update and return
        var householdMeal = mealRepository.findByNameAndHousehold(trimmed, household);
        if (householdMeal.isPresent()) {
            Meal m = householdMeal.get();
            m.setRecipeLink(recipeLink);
            m.setNotes(notes);
            m.setShared(shared);
            return mealRepository.save(m);
        }

        // Shared meal with same name — use it if we're not marking this one shared
        var sharedMeal = mealRepository.findFirstByNameAndSharedTrue(trimmed);
        if (sharedMeal.isPresent() && !shared) {
            return sharedMeal.get();
        }

        // Create new meal belonging to this household
        Meal m = new Meal();
        m.setName(trimmed);
        m.setRecipeLink(recipeLink);
        m.setNotes(notes);
        m.setHousehold(household);
        m.setShared(shared);
        return mealRepository.save(m);
    }
}
