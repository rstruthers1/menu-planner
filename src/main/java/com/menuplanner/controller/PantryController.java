package com.menuplanner.controller;

import com.menuplanner.domain.Household;
import com.menuplanner.domain.PantryItem;
import com.menuplanner.repository.PantryRepository;
import com.menuplanner.security.AppUserDetails;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/pantry")
public class PantryController {

    private final PantryRepository pantryRepository;

    public PantryController(PantryRepository pantryRepository) {
        this.pantryRepository = pantryRepository;
    }

    @GetMapping
    public Map<String, Object> getPantry(@AuthenticationPrincipal AppUserDetails userDetails) {
        List<String> items = pantryRepository.findByHouseholdOrderByName(userDetails.getHousehold())
                .stream().map(PantryItem::getName).collect(Collectors.toList());
        return Map.of("items", items);
    }

    @PutMapping
    @Transactional
    public Map<String, Object> setPantry(@RequestBody Map<String, List<String>> body,
                                          @AuthenticationPrincipal AppUserDetails userDetails) {
        Household household = userDetails.getHousehold();
        pantryRepository.deleteByHousehold(household);
        List<String> names = body.getOrDefault("items", List.of());
        for (String name : names) {
            if (name == null || name.isBlank()) continue;
            PantryItem item = new PantryItem();
            item.setName(name.trim());
            item.setHousehold(household);
            pantryRepository.save(item);
        }
        List<String> saved = pantryRepository.findByHouseholdOrderByName(household)
                .stream().map(PantryItem::getName).collect(Collectors.toList());
        return Map.of("items", saved);
    }
}
