package com.menuplanner.service;

import com.menuplanner.domain.MenuEntry;
import com.menuplanner.repository.MenuEntryRepository;
import org.springframework.stereotype.Service;

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
}
