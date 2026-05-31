package com.menuplanner.controller;

import com.menuplanner.domain.Meal;
import com.menuplanner.repository.MealRepository;
import com.menuplanner.security.AppUserDetails;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/meals")
public class MealController {

    private final MealRepository mealRepository;

    public MealController(MealRepository mealRepository) {
        this.mealRepository = mealRepository;
    }

    @GetMapping
    public List<Map<String, Object>> getMeals(@AuthenticationPrincipal AppUserDetails userDetails) {
        return mealRepository.findMealsForHousehold(userDetails.getHousehold()).stream()
                .map(m -> {
                    Map<String, Object> resp = new LinkedHashMap<>();
                    resp.put("id", m.getId());
                    resp.put("name", m.getName());
                    resp.put("minTemp", m.getMinTemp());
                    resp.put("maxTemp", m.getMaxTemp());
                    return resp;
                })
                .collect(Collectors.toList());
    }

    @GetMapping("/check")
    public Map<String, Boolean> checkName(@RequestParam String name,
                                          @AuthenticationPrincipal AppUserDetails userDetails) {
        String trimmed = name.trim();
        boolean existsInHousehold = mealRepository.findByNameAndHousehold(trimmed, userDetails.getHousehold()).isPresent();
        boolean existsShared = mealRepository.findFirstByNameAndSharedTrue(trimmed).isPresent();
        return Map.of("existsInHousehold", existsInHousehold, "existsShared", existsShared);
    }

    @PostMapping
    public Map<String, Object> createMeal(@RequestBody MealRequest req,
                                          @AuthenticationPrincipal AppUserDetails userDetails) {
        Meal meal = new Meal();
        meal.setName(req.name().trim());
        meal.setRecipeLink(req.recipeLink());
        meal.setNotes(req.notes());
        meal.setHousehold(userDetails.getHousehold());
        meal.setShared(Boolean.TRUE.equals(req.shared()));
        meal.setMinTemp(req.minTemp());
        meal.setMaxTemp(req.maxTemp());
        Meal saved = mealRepository.save(meal);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("id", saved.getId());
        resp.put("name", saved.getName());
        resp.put("recipeLink", saved.getRecipeLink());
        resp.put("notes", saved.getNotes());
        resp.put("shared", saved.isShared());
        resp.put("minTemp", saved.getMinTemp());
        resp.put("maxTemp", saved.getMaxTemp());
        return resp;
    }

    record MealRequest(String name, String recipeLink, String notes, Boolean shared, Integer minTemp, Integer maxTemp) {}
}
