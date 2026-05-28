package com.menuplanner.controller;

import com.menuplanner.domain.MenuEntry;
import com.menuplanner.domain.WeatherRecord;
import com.menuplanner.repository.WeatherRecordRepository;
import com.menuplanner.service.MenuEntryService;
import com.menuplanner.service.WeatherService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
public class HistoryController {

    private final MenuEntryService menuEntryService;
    private final WeatherRecordRepository weatherRecordRepository;
    private final WeatherService weatherService;

    public HistoryController(MenuEntryService menuEntryService,
                             WeatherRecordRepository weatherRecordRepository,
                             WeatherService weatherService) {
        this.menuEntryService = menuEntryService;
        this.weatherRecordRepository = weatherRecordRepository;
        this.weatherService = weatherService;
    }

    @GetMapping("/api/history")
    public List<Map<String, Object>> getHistory() {
        List<MenuEntry> pastMeals = menuEntryService.getPastMeals();

        List<LocalDate> dates = pastMeals.stream()
                .map(MenuEntry::getMealDate)
                .filter(d -> d != null)
                .collect(Collectors.toList());

        Map<LocalDate, WeatherRecord> weatherByDate = weatherRecordRepository.findByDateIn(dates)
                .stream()
                .collect(Collectors.toMap(WeatherRecord::getDate, w -> w));

        // Lazy-fill any past dates that have no cached weather record
        dates.stream()
                .filter(d -> !weatherByDate.containsKey(d))
                .forEach(d -> weatherService.ensureCached(d)
                        .ifPresent(r -> weatherByDate.put(d, r)));

        return pastMeals.stream().map(meal -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", meal.getId());
            item.put("mealDate", meal.getMealDate() != null ? meal.getMealDate().toString() : null);
            item.put("dayOfWeek", meal.getDayOfWeek());
            com.menuplanner.domain.Meal mealDef = meal.getMeal();
            item.put("mealName", mealDef != null ? mealDef.getName() : null);
            item.put("recipeLink", mealDef != null ? mealDef.getRecipeLink() : null);
            item.put("notes", mealDef != null ? mealDef.getNotes() : null);
            WeatherRecord w = meal.getMealDate() != null ? weatherByDate.get(meal.getMealDate()) : null;
            if (w != null) {
                item.put("condition", w.getCondition());
                item.put("highTempF", w.getHighTempF());
                item.put("lowTempF", w.getLowTempF());
            }
            return item;
        }).collect(Collectors.toList());
    }
}
