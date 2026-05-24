package com.menuplanner.service;

import com.menuplanner.domain.MenuEntry;
import com.menuplanner.repository.MenuEntryRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class MenuEntryService {

    private final MenuEntryRepository repository;

    public MenuEntryService(MenuEntryRepository repository) {
        this.repository = repository;
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
        existing.setMealName(updated.getMealName());
        existing.setWeather(updated.getWeather());
        existing.setHighTempF(updated.getHighTempF());
        existing.setLowTempF(updated.getLowTempF());
        existing.setRecipeLink(updated.getRecipeLink());
        existing.setNotes(updated.getNotes());
        return repository.save(existing);
    }

    public void deleteMenu(Long id) {
        repository.deleteById(id);
    }

    public List<String> getMealNames() {
        return repository.findDistinctMealNames();
    }
}
