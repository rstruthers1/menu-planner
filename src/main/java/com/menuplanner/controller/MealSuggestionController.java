package com.menuplanner.controller;

import com.menuplanner.service.MealSuggestionService;
import com.menuplanner.service.MenuEntryService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/suggest-meals")
public class MealSuggestionController {

    private final MealSuggestionService suggestionService;
    private final MenuEntryService menuEntryService;

    public MealSuggestionController(MealSuggestionService suggestionService, MenuEntryService menuEntryService) {
        this.suggestionService = suggestionService;
        this.menuEntryService = menuEntryService;
    }

    @PostMapping
    public Map<String, String> suggestMeals(@RequestBody SuggestionRequest request) {
        List<String> mealLibrary = menuEntryService.getMealNames();
        return suggestionService.suggestMeals(
                request.weekStart(), request.prompt(), mealLibrary,
                request.weather(), request.existingMeals(), request.targetDate()
        );
    }

    record SuggestionRequest(
            String weekStart,
            String prompt,
            Map<String, Map<String, Object>> weather,
            Map<String, String> existingMeals,  // dateStr -> mealName already planned
            String targetDate                    // null = whole week, set = single day
    ) {}
}
