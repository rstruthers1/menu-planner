package com.menuplanner.controller;

import com.menuplanner.domain.MenuEntry;
import com.menuplanner.domain.WeatherRecord;
import com.menuplanner.repository.WeatherRecordRepository;
import com.menuplanner.security.AppUserDetails;
import com.menuplanner.service.MenuEntryService;
import com.menuplanner.service.WeatherService;
import org.springframework.data.domain.Page;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
    public Map<String, Object> getHistory(
            @AuthenticationPrincipal AppUserDetails userDetails,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        Page<MenuEntry> resultPage = menuEntryService.getPastMealsPage(userDetails.getHousehold(), page, size);
        List<MenuEntry> entries = resultPage.getContent();

        List<LocalDate> dates = entries.stream()
                .map(MenuEntry::getMealDate)
                .filter(d -> d != null)
                .collect(Collectors.toList());

        Map<LocalDate, WeatherRecord> weatherByDate = weatherRecordRepository.findByDateIn(dates)
                .stream()
                .collect(Collectors.toMap(WeatherRecord::getDate, w -> w));

        dates.stream()
                .filter(d -> !weatherByDate.containsKey(d))
                .forEach(d -> weatherService.ensureCached(d)
                        .ifPresent(r -> weatherByDate.put(d, r)));

        List<Map<String, Object>> items = entries.stream().map(meal -> {
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

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("entries", items);
        response.put("page", resultPage.getNumber());
        response.put("totalPages", resultPage.getTotalPages());
        response.put("totalElements", resultPage.getTotalElements());
        return response;
    }

    @GetMapping("/api/history/page-for-date")
    public Map<String, Object> getPageForDate(
            @AuthenticationPrincipal AppUserDetails userDetails,
            @RequestParam String date,
            @RequestParam(defaultValue = "10") int size) {

        LocalDate localDate = LocalDate.parse(date);
        int pageNum = menuEntryService.getPageForDate(localDate, userDetails.getHousehold(), size);
        return Map.of("page", pageNum);
    }
}
