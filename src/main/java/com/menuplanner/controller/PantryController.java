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

    private static final List<String> SECTIONS = List.of("refrigerator", "freezer", "cupboard");

    private final PantryRepository pantryRepository;

    public PantryController(PantryRepository pantryRepository) {
        this.pantryRepository = pantryRepository;
    }

    @GetMapping
    public Map<String, Object> getPantry(@AuthenticationPrincipal AppUserDetails userDetails) {
        List<PantryItem> all = pantryRepository.findByHouseholdOrderByName(userDetails.getHousehold());
        Map<String, List<String>> bySec = all.stream()
                .collect(Collectors.groupingBy(
                        p -> p.getSection() != null ? p.getSection() : "cupboard",
                        Collectors.mapping(PantryItem::getName, Collectors.toList())
                ));
        // Always include all sections even if empty
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        for (String sec : SECTIONS) result.put(sec, bySec.getOrDefault(sec, List.of()));
        return result;
    }

    @PutMapping
    @Transactional
    public Map<String, Object> setPantry(@RequestBody Map<String, List<String>> body,
                                          @AuthenticationPrincipal AppUserDetails userDetails) {
        Household household = userDetails.getHousehold();
        pantryRepository.deleteByHousehold(household);
        for (String section : SECTIONS) {
            List<String> names = body.getOrDefault(section, List.of());
            for (String name : names) {
                if (name == null || name.isBlank()) continue;
                PantryItem item = new PantryItem();
                item.setName(name.trim());
                item.setSection(section);
                item.setHousehold(household);
                pantryRepository.save(item);
            }
        }
        return getPantry(userDetails);
    }
}
