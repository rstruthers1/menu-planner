package com.menuplanner.controller;

import com.menuplanner.domain.MenuEntry;
import com.menuplanner.service.MenuEntryService;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/menus")
public class MenuEntryController {

    private final MenuEntryService service;

    public MenuEntryController(MenuEntryService service) {
        this.service = service;
    }

    @GetMapping
    public List<MenuEntry> getAllMenus() {
        return service.getAllMenus();
    }

    @GetMapping("/week")
    public List<MenuEntry> getMenusForWeek(@RequestParam String start) {
        LocalDate startDate = LocalDate.parse(start);
        return service.getMenusForWeek(startDate, startDate.plusDays(6));
    }

    @GetMapping("/meal-names")
    public List<String> getMealNames() {
        return service.getMealNames();
    }

    @PostMapping
    public MenuEntry addMenu(@RequestBody MenuEntry entry) {
        return service.saveMenu(entry);
    }

    @PutMapping("/{id}")
    public MenuEntry updateMenu(@PathVariable Long id, @RequestBody MenuEntry entry) {
        return service.updateMenu(id, entry);
    }

    @DeleteMapping("/{id}")
    public void deleteMenu(@PathVariable Long id) {
        service.deleteMenu(id);
    }
}
