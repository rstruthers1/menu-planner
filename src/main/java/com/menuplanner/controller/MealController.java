package com.menuplanner.controller;

import com.menuplanner.domain.Meal;
import com.menuplanner.repository.MealRepository;
import com.menuplanner.repository.MenuEntryRepository;
import com.menuplanner.security.AppUserDetails;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/meals")
public class MealController {

    private static final Logger log = LoggerFactory.getLogger(MealController.class);

    private final MealRepository mealRepository;
    private final MenuEntryRepository menuEntryRepository;

    public MealController(MealRepository mealRepository, MenuEntryRepository menuEntryRepository) {
        this.mealRepository = mealRepository;
        this.menuEntryRepository = menuEntryRepository;
    }

    @GetMapping
    public List<Map<String, Object>> getMeals(@AuthenticationPrincipal AppUserDetails userDetails) {
        return mealRepository.findMealsForHousehold(userDetails.getHousehold()).stream()
                .map(this::toResponse)
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
        meal.setHousehold(userDetails.getHousehold());
        applyRequest(meal, req);
        return toResponse(mealRepository.save(meal));
    }

    @GetMapping("/{id}/debug")
    public Map<String, Object> debugMeal(@PathVariable Long id,
                                         @AuthenticationPrincipal AppUserDetails userDetails) {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("requestedMealId", id);
        info.put("userHouseholdId", userDetails.getHousehold().getId());
        mealRepository.findById(id).ifPresentOrElse(m -> {
            info.put("mealFound", true);
            info.put("mealName", m.getName());
            info.put("mealHouseholdId", m.getHousehold() != null ? m.getHousehold().getId() : null);
            info.put("mealShared", m.isShared());
        }, () -> info.put("mealFound", false));
        return info;
    }

    @PutMapping("/{id}")
    public Map<String, Object> updateMeal(@PathVariable Long id, @RequestBody MealRequest req,
                                          @AuthenticationPrincipal AppUserDetails userDetails) {
        Meal meal = mealRepository.findByIdForHousehold(id, userDetails.getHousehold().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Meal not found or belongs to another household"));
        meal.setName(req.name().trim());
        applyRequest(meal, req);
        return toResponse(mealRepository.save(meal));
    }

    @DeleteMapping("/{id}")
    public void deleteMeal(@PathVariable Long id,
                           @AuthenticationPrincipal AppUserDetails userDetails) {
        log.debug("deleteMeal called: id={} userHouseholdId={}", id, userDetails.getHousehold().getId());
        Meal meal = mealRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        Long mealHouseholdId = meal.getHousehold() != null ? meal.getHousehold().getId() : null;
        log.debug("meal householdId={} shared={}", mealHouseholdId, meal.isShared());
        if (!userDetails.getHousehold().getId().equals(mealHouseholdId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Meal not found or belongs to another household (meal=" + mealHouseholdId + " user=" + userDetails.getHousehold().getId() + ")");
        }
        if (menuEntryRepository.existsByMeal(meal)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This meal is used in your plan — remove it from all days first.");
        }
        mealRepository.deleteById(id);
    }

    private void applyRequest(Meal meal, MealRequest req) {
        meal.setRecipeLink(req.recipeLink());
        meal.setNotes(req.notes());
        meal.setShared(Boolean.TRUE.equals(req.shared()));
        meal.setMinTemp(req.minTemp());
        meal.setMaxTemp(req.maxTemp());
        meal.setSeasons(req.seasons() == null || req.seasons().isEmpty() ? null
                : req.seasons().stream().filter(s -> s != null && !s.isBlank()).collect(Collectors.joining(",")));
    }

    private Map<String, Object> toResponse(Meal m) {
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("id", m.getId());
        resp.put("name", m.getName());
        resp.put("recipeLink", m.getRecipeLink());
        resp.put("notes", m.getNotes());
        resp.put("shared", m.isShared());
        resp.put("minTemp", m.getMinTemp());
        resp.put("maxTemp", m.getMaxTemp());
        resp.put("seasons", m.getSeasons() != null
                ? Arrays.stream(m.getSeasons().split(",")).filter(s -> !s.isBlank()).collect(Collectors.toList())
                : List.of());
        return resp;
    }

    record MealRequest(String name, String recipeLink, String notes, Boolean shared,
                       Integer minTemp, Integer maxTemp, List<String> seasons) {}
}
