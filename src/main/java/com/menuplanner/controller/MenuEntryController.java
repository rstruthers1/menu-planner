package com.menuplanner.controller;

import com.menuplanner.domain.Household;
import com.menuplanner.domain.Meal;
import com.menuplanner.domain.MenuEntry;
import com.menuplanner.domain.Side;
import com.menuplanner.security.AppUserDetails;
import com.menuplanner.service.MenuEntryService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/menus")
public class MenuEntryController {

    private final MenuEntryService service;

    public MenuEntryController(MenuEntryService service) {
        this.service = service;
    }

    @GetMapping
    public List<Map<String, Object>> getAllMenus(@AuthenticationPrincipal AppUserDetails userDetails) {
        return service.getAllMenus(userDetails.getHousehold()).stream().map(this::toResponse).collect(Collectors.toList());
    }

    @GetMapping("/week")
    public List<Map<String, Object>> getMenusForWeek(@RequestParam String start,
                                                      @AuthenticationPrincipal AppUserDetails userDetails) {
        LocalDate startDate = LocalDate.parse(start);
        return service.getMenusForWeek(startDate, startDate.plusDays(6), userDetails.getHousehold())
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @GetMapping("/meal-names")
    public List<String> getMealNames(@AuthenticationPrincipal AppUserDetails userDetails) {
        return service.getMealNames(userDetails.getHousehold());
    }

    @PostMapping
    public Map<String, Object> addMenu(@RequestBody MenuEntryRequest req,
                                       @AuthenticationPrincipal AppUserDetails userDetails) {
        Household household = userDetails.getHousehold();
        boolean shared = Boolean.TRUE.equals(req.shared());
        Meal meal = service.findOrCreateMeal(req.mealName(), req.recipeLink(), req.notes(), req.minTemp(), req.maxTemp(), req.seasons(), shared, household);
        MenuEntry entry = new MenuEntry();
        entry.setMealDate(req.mealDate() != null ? LocalDate.parse(req.mealDate()) : null);
        entry.setDayOfWeek(req.dayOfWeek());
        entry.setConfirmed(req.confirmed());
        entry.setLeftover(req.leftover());
        entry.setLeftoverFromDate(req.leftoverFromDate() != null && !req.leftoverFromDate().isBlank()
                ? LocalDate.parse(req.leftoverFromDate()) : null);
        entry.setMeal(meal);
        entry.setHousehold(household);
        return toResponse(service.saveMenu(entry));
    }

    @PutMapping("/{id}")
    public Map<String, Object> updateMenu(@PathVariable Long id, @RequestBody MenuEntryRequest req,
                                          @AuthenticationPrincipal AppUserDetails userDetails) {
        Household household = userDetails.getHousehold();
        boolean shared = Boolean.TRUE.equals(req.shared());
        Meal meal = service.findOrCreateMeal(req.mealName(), req.recipeLink(), req.notes(), req.minTemp(), req.maxTemp(), req.seasons(), shared, household);
        MenuEntry updated = new MenuEntry();
        updated.setMeal(meal);
        updated.setConfirmed(req.confirmed());
        updated.setLeftover(req.leftover());
        updated.setLeftoverFromDate(req.leftoverFromDate() != null && !req.leftoverFromDate().isBlank()
                ? LocalDate.parse(req.leftoverFromDate()) : null);
        return toResponse(service.updateMenu(id, updated));
    }

    @PatchMapping("/{id}/confirmed")
    public Map<String, Object> setConfirmed(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        return toResponse(service.setConfirmed(id, Boolean.TRUE.equals(body.get("confirmed"))));
    }

    @DeleteMapping("/{id}")
    public void deleteMenu(@PathVariable Long id) {
        service.deleteMenu(id);
    }

    private Map<String, Object> toResponse(MenuEntry entry) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", entry.getId());
        m.put("mealDate", entry.getMealDate() != null ? entry.getMealDate().toString() : null);
        m.put("dayOfWeek", entry.getDayOfWeek());
        m.put("confirmed", entry.getConfirmed());
        Meal meal = entry.getMeal();
        m.put("mealName", meal != null ? meal.getName() : null);
        m.put("recipeLink", meal != null ? meal.getRecipeLink() : null);
        m.put("notes", meal != null ? meal.getNotes() : null);
        m.put("mealId", meal != null ? meal.getId() : null);
        m.put("shared", meal != null && meal.isShared());
        m.put("minTemp", meal != null ? meal.getMinTemp() : null);
        m.put("maxTemp", meal != null ? meal.getMaxTemp() : null);
        m.put("seasons", meal != null && meal.getSeasons() != null
                ? Arrays.stream(meal.getSeasons().split(",")).filter(s -> !s.isBlank()).collect(Collectors.toList())
                : List.of());
        m.put("leftover", entry.getLeftover());
        m.put("leftoverFromDate", entry.getLeftoverFromDate() != null ? entry.getLeftoverFromDate().toString() : null);
        String sides = meal != null && meal.getSides() != null && !meal.getSides().isEmpty()
                ? meal.getSides().stream().map(Side::getName).collect(Collectors.joining(", "))
                : null;
        m.put("sides", sides);
        return m;
    }

    record MenuEntryRequest(
            String mealDate, String dayOfWeek, String mealName,
            String recipeLink, String notes, Boolean confirmed,
            Boolean leftover, String leftoverFromDate, Boolean shared,
            Integer minTemp, Integer maxTemp, List<String> seasons
    ) {}
}
