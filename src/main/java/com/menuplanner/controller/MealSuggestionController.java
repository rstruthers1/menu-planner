package com.menuplanner.controller;

import com.menuplanner.domain.MenuEntry;
import com.menuplanner.domain.WeatherRecord;
import com.menuplanner.repository.WeatherRecordRepository;
import com.menuplanner.service.MealSuggestionService;
import com.menuplanner.service.MenuEntryService;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/suggest-meals")
public class MealSuggestionController {

    private final MealSuggestionService suggestionService;
    private final MenuEntryService menuEntryService;
    private final WeatherRecordRepository weatherRecordRepository;

    public MealSuggestionController(MealSuggestionService suggestionService,
                                    MenuEntryService menuEntryService,
                                    WeatherRecordRepository weatherRecordRepository) {
        this.suggestionService = suggestionService;
        this.menuEntryService = menuEntryService;
        this.weatherRecordRepository = weatherRecordRepository;
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
            Map<String, String> existingMeals,
            String targetDate
    ) {}

    @PostMapping("/chat")
    public Map<String, Object> chat(@RequestBody ChatRequest request) {
        List<Map<String, Object>> history = buildHistory();
        return suggestionService.chat(
                request.targetDate(), request.dayName(),
                request.weather(), request.existingMeals(),
                request.mealLibrary(), request.messages(), history
        );
    }

    private List<Map<String, Object>> buildHistory() {
        List<MenuEntry> pastMeals = menuEntryService.getPastMeals();
        List<LocalDate> dates = pastMeals.stream()
                .map(MenuEntry::getMealDate)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        Map<LocalDate, WeatherRecord> weatherByDate = weatherRecordRepository.findByDateIn(dates)
                .stream()
                .collect(Collectors.toMap(WeatherRecord::getDate, w -> w));

        return pastMeals.stream().map(meal -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("dayOfWeek", meal.getDayOfWeek());
            item.put("mealName", meal.getMeal() != null ? meal.getMeal().getName() : null);
            WeatherRecord w = meal.getMealDate() != null ? weatherByDate.get(meal.getMealDate()) : null;
            if (w != null) {
                item.put("highTempF", w.getHighTempF());
                item.put("condition", w.getCondition());
            }
            return item;
        }).collect(Collectors.toList());
    }

    record ChatRequest(
            String targetDate,
            String dayName,
            String weekStart,
            Map<String, Object> weather,
            Map<String, String> existingMeals,
            List<String> mealLibrary,
            List<Map<String, String>> messages
    ) {}
}
