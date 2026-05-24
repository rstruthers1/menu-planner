package com.menuplanner.controller;

import com.menuplanner.domain.MenuEntry;
import com.menuplanner.service.MenuEntryService;
import org.springframework.web.bind.annotation.*;

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

    @PostMapping
    public MenuEntry addMenu(@RequestBody MenuEntry entry) {
        return service.saveMenu(entry);
    }
}
