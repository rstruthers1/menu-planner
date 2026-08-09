package com.menuplanner.controller;

import com.menuplanner.domain.Household;
import com.menuplanner.domain.Meal;
import com.menuplanner.domain.MenuEntry;
import com.menuplanner.domain.WeatherRecord;
import com.menuplanner.repository.MealRepository;
import com.menuplanner.repository.WeatherRecordRepository;
import com.menuplanner.security.AppUserDetails;
import com.menuplanner.service.MealSuggestionService;
import com.menuplanner.service.MenuEntryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/suggest-meals")
public class MealSuggestionController {

    private static final Logger log = LoggerFactory.getLogger(MealSuggestionController.class);

    private final MealSuggestionService suggestionService;
    private final MenuEntryService menuEntryService;
    private final MealRepository mealRepository;
    private final WeatherRecordRepository weatherRecordRepository;

    public MealSuggestionController(MealSuggestionService suggestionService,
                                    MenuEntryService menuEntryService,
                                    MealRepository mealRepository,
                                    WeatherRecordRepository weatherRecordRepository) {
        this.suggestionService = suggestionService;
        this.menuEntryService = menuEntryService;
        this.mealRepository = mealRepository;
        this.weatherRecordRepository = weatherRecordRepository;
    }

    @PostMapping
    public Map<String, String> suggestMeals(@RequestBody SuggestionRequest request,
                                             @AuthenticationPrincipal AppUserDetails userDetails) {
        Household household = userDetails.getHousehold();
        // Use weekStart to determine season for pre-filtering
        List<String> richLibrary = buildRichMealLibrary(household, request.weekStart(), null, false);
        return suggestionService.suggestMeals(
                request.weekStart(), request.prompt(), richLibrary,
                request.weather(), request.existingMeals(), request.targetDate()
        );
    }

    @PostMapping("/chat")
    public Map<String, Object> chat(@RequestBody ChatRequest request,
                                    @AuthenticationPrincipal AppUserDetails userDetails) {
        Household household = userDetails.getHousehold();
        List<Map<String, Object>> history = buildHistory(household);
        List<String> recentMealNames = menuEntryService.getRecentMealNames(household);

        // Determine if target day is a weekend
        boolean isWeekend = false;
        if (request.targetDate() != null) {
            try {
                int dow = LocalDate.parse(request.targetDate()).getDayOfWeek().getValue();
                isWeekend = dow >= 6;
            } catch (Exception ignored) {}
        }

        // Extract high temp for pre-filtering
        Integer highTemp = null;
        if (request.weather() != null && request.weather().get("high") instanceof Number n) {
            highTemp = n.intValue();
        }

        List<String> richLibrary = buildRichMealLibrary(household, request.targetDate(), highTemp, isWeekend);
        log.info("Rich meal library ({} meals) for {}", richLibrary.size(), request.targetDate());

        return suggestionService.chat(
                request.targetDate(), request.dayName(), request.weekStart(),
                request.weather(), request.existingMeals(),
                richLibrary, request.messages(), history, recentMealNames
        );
    }

    /**
     * Loads meals for the household and builds a rich library with constraint annotations.
     * Pre-filters meals that clearly don't fit the given date/weather context.
     *
     * @param targetDate  ISO date string; if null, only season filtering is skipped for temp/weekend
     * @param highTempF   high temperature for the day; null = no temp pre-filter
     * @param isWeekend   whether the target day is Sat/Sun; false = weekday
     */
    private List<String> buildRichMealLibrary(Household household, String targetDate,
                                               Integer highTempF, boolean isWeekend) {
        List<Meal> meals = mealRepository.findMealsForHousehold(household);

        String season = null;
        if (targetDate != null) {
            try {
                int month = LocalDate.parse(targetDate).getMonthValue();
                season = month >= 3 && month <= 5 ? "SPRING"
                        : month >= 6 && month <= 8 ? "SUMMER"
                        : month >= 9 && month <= 11 ? "FALL" : "WINTER";
            } catch (Exception ignored) {}
        }

        final String finalSeason = season;

        return meals.stream()
                .filter(m -> {
                    // Exclude weekend-only meals on weekdays (when we know the day)
                    if (m.isWeekendOnly() && targetDate != null && !isWeekend) return false;
                    // Exclude meals whose temp range is way off (>15°F buffer to avoid false exclusions)
                    if (highTempF != null) {
                        if (m.getMinTemp() != null && highTempF < m.getMinTemp() - 15) return false;
                        if (m.getMaxTemp() != null && highTempF > m.getMaxTemp() + 15) return false;
                    }
                    // Exclude meals restricted to a different season
                    if (finalSeason != null && m.getSeasons() != null && !m.getSeasons().isBlank()) {
                        if (!m.getSeasons().contains(finalSeason)) return false;
                    }
                    return true;
                })
                .map(m -> {
                    List<String> tags = new ArrayList<>();
                    if (m.getCookMethods() != null && !m.getCookMethods().isBlank())
                        tags.add("method: " + m.getCookMethods().replace(",", "/"));
                    if (m.getSeasons() != null && !m.getSeasons().isBlank())
                        tags.add("seasons: " + m.getSeasons().replace(",", "/"));
                    if (m.getMinTemp() != null && m.getMaxTemp() != null)
                        tags.add("temp: " + m.getMinTemp() + "–" + m.getMaxTemp() + "°F");
                    else if (m.getMinTemp() != null)
                        tags.add("min temp: " + m.getMinTemp() + "°F");
                    else if (m.getMaxTemp() != null)
                        tags.add("max temp: " + m.getMaxTemp() + "°F");
                    if (m.isWeekendOnly()) tags.add("weekend only");

                    return tags.isEmpty() ? m.getName()
                            : m.getName() + " [" + String.join(", ", tags) + "]";
                })
                .sorted()
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> buildHistory(Household household) {
        List<MenuEntry> pastMeals = menuEntryService.getPastMeals(household);
        List<LocalDate> dates = pastMeals.stream()
                .map(MenuEntry::getMealDate)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        Map<LocalDate, WeatherRecord> weatherByDate = weatherRecordRepository.findByDateIn(dates)
                .stream()
                .collect(Collectors.toMap(WeatherRecord::getDate, w -> w));

        return pastMeals.stream().map(meal -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("mealDate", meal.getMealDate() != null ? meal.getMealDate().toString() : null);
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

    record SuggestionRequest(
            String weekStart,
            String prompt,
            Map<String, Map<String, Object>> weather,
            Map<String, String> existingMeals,
            String targetDate
    ) {}

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
