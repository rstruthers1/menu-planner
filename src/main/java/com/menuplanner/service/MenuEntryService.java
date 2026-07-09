package com.menuplanner.service;

import com.menuplanner.domain.Household;
import com.menuplanner.domain.Meal;
import com.menuplanner.domain.MenuEntry;
import com.menuplanner.repository.MealRepository;
import com.menuplanner.repository.MenuEntryRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

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
        if (entry.getMealDate() != null && entry.getHousehold() != null) {
            List<MenuEntry> existing = repository.findByMealDateAndHousehold(entry.getMealDate(), entry.getHousehold());
            if (!existing.isEmpty()) {
                MenuEntry canonical = existing.get(0);
                canonical.setMeal(entry.getMeal());
                canonical.setDayOfWeek(entry.getDayOfWeek());
                canonical.setConfirmed(entry.getConfirmed());
                canonical.setLeftover(entry.getLeftover());
                canonical.setLeftoverFromDate(entry.getLeftoverFromDate());
                existing.stream().skip(1).map(MenuEntry::getId).forEach(repository::deleteById);
                return repository.save(canonical);
            }
        }
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
        MenuEntry saved = repository.save(existing);
        // Remove any other entries for the same date+household
        if (saved.getMealDate() != null && saved.getHousehold() != null) {
            repository.findByMealDateAndHousehold(saved.getMealDate(), saved.getHousehold())
                    .stream().filter(e -> !e.getId().equals(saved.getId()))
                    .map(MenuEntry::getId)
                    .forEach(repository::deleteById);
        }
        return saved;
    }

    public MenuEntry setConfirmed(Long id, boolean confirmed) {
        MenuEntry existing = repository.findById(id).orElseThrow();
        existing.setConfirmed(confirmed);
        return repository.save(existing);
    }

    public List<MenuEntry> getPastMeals(Household household) {
        return repository.findByMealDateLessThanEqualAndHouseholdOrderByMealDateDesc(LocalDate.now(), household);
    }

    public Page<MenuEntry> getPastMealsPage(Household household, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "mealDate"));
        return repository.findByMealDateLessThanEqualAndHousehold(LocalDate.now(), household, pageable);
    }

    public int getPageForDate(LocalDate date, Household household, int size) {
        long position = repository.countEntriesNewerThan(date, LocalDate.now(), household.getId());
        return (int) (position / size);
    }

    public void deleteMenu(Long id) {
        repository.deleteById(id);
    }

    public List<String> getRecentMealNames(Household household) {
        LocalDate cutoff = LocalDate.now().minusDays(14);
        return repository.findByMealDateBetweenAndHousehold(cutoff, LocalDate.now(), household)
                .stream()
                .map(e -> e.getMeal() != null ? e.getMeal().getName() : null)
                .filter(m -> m != null && !m.isEmpty())
                .distinct()
                .collect(Collectors.toList());
    }

    public List<String> getMealNames(Household household) {
        return mealRepository.findNamesForHousehold(household);
    }

    public List<Meal> getMeals(Household household) {
        return mealRepository.findMealsForHousehold(household);
    }

    public Meal findOrCreateMeal(String name, String recipeLink, String notes,
                                  Integer minTemp, Integer maxTemp, List<String> seasons,
                                  boolean shared, Household household) {
        if (name == null || name.isBlank()) return null;
        String trimmed = name.trim();
        String seasonsStr = seasons == null || seasons.isEmpty() ? null
                : seasons.stream().filter(s -> s != null && !s.isBlank()).collect(Collectors.joining(","));

        // Existing meal in this household — update and return
        var householdMeal = mealRepository.findByNameAndHousehold(trimmed, household);
        if (householdMeal.isPresent()) {
            Meal m = householdMeal.get();
            m.setRecipeLink(recipeLink);
            m.setNotes(notes);
            m.setMinTemp(minTemp);
            m.setMaxTemp(maxTemp);
            m.setSeasons(seasonsStr);
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
        m.setMinTemp(minTemp);
        m.setMaxTemp(maxTemp);
        m.setSeasons(seasonsStr);
        m.setHousehold(household);
        m.setShared(shared);
        return mealRepository.save(m);
    }
}
