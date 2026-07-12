package com.menuplanner.service;

import com.menuplanner.domain.Household;
import com.menuplanner.domain.Meal;
import com.menuplanner.repository.MenuEntryRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RulesSuggestionService {

    private final MenuEntryRepository menuEntryRepository;
    private final MenuEntryService menuEntryService;

    public RulesSuggestionService(MenuEntryRepository menuEntryRepository, MenuEntryService menuEntryService) {
        this.menuEntryRepository = menuEntryRepository;
        this.menuEntryService = menuEntryService;
    }

    public record RulesConfig(Integer noRepeatDays, Boolean seasonMatch, Boolean weatherMatch, List<String> excludeMethods) {
        int effectiveRepeatDays() { return noRepeatDays != null ? noRepeatDays : 14; }
        boolean effectiveSeasonMatch() { return seasonMatch != null ? seasonMatch : true; }
        boolean effectiveWeatherMatch() { return weatherMatch != null ? weatherMatch : true; }
        List<String> effectiveExcludeMethods() { return excludeMethods != null ? excludeMethods : List.of(); }
    }

    public Map<String, String> suggest(
            Household household,
            String weekStartStr,
            Map<String, String> existingMeals,
            Map<String, Map<String, Object>> weather,
            RulesConfig rules,
            String targetDateStr
    ) {
        LocalDate weekStart = LocalDate.parse(weekStartStr);
        List<Meal> allMeals = menuEntryService.getMeals(household);

        LocalDate cutoff = weekStart.minusDays(rules.effectiveRepeatDays());
        Set<String> recentMeals = menuEntryRepository
                .findByMealDateBetweenAndHousehold(cutoff, weekStart.minusDays(1), household)
                .stream()
                .map(e -> e.getMeal() != null ? e.getMeal().getName() : null)
                .filter(n -> n != null && !n.isBlank())
                .collect(Collectors.toSet());

        List<LocalDate> targetDates;
        if (targetDateStr != null) {
            targetDates = List.of(LocalDate.parse(targetDateStr));
        } else {
            targetDates = new ArrayList<>();
            for (int i = 0; i < 7; i++) {
                LocalDate d = weekStart.plusDays(i);
                String ds = d.toString();
                if (existingMeals == null || !existingMeals.containsKey(ds) || existingMeals.get(ds).isBlank()) {
                    targetDates.add(d);
                }
            }
        }

        Set<String> usedThisWeek = existingMeals == null ? new HashSet<>()
                : existingMeals.values().stream().filter(v -> v != null && !v.isBlank()).collect(Collectors.toSet());
        List<String> excludeMethods = rules.effectiveExcludeMethods();

        Map<String, String> result = new LinkedHashMap<>();
        for (LocalDate date : targetDates) {
            String dateStr = date.toString();
            String season = getSeason(date);
            Map<String, Object> dayWeather = weather != null ? weather.get(dateStr) : null;
            boolean weeknight = isWeeknight(date);

            // Hard filters: excluded methods and weeknight — never relaxed
            List<Meal> eligible = allMeals.stream()
                    .filter(m -> !weeknight || !m.isWeekendOnly())
                    .filter(m -> {
                        if (excludeMethods.isEmpty()) return true;
                        if (m.getCookMethods() == null || m.getCookMethods().isBlank()) return true;
                        return Arrays.stream(m.getCookMethods().split(",")).noneMatch(excludeMethods::contains);
                    })
                    .collect(Collectors.toList());

            // Progressive relaxation on repeat/season/weather within the hard-filtered set
            String pick = tryPick(eligible, recentMeals, usedThisWeek, season, dayWeather, rules.effectiveSeasonMatch(), rules.effectiveWeatherMatch());
            if (pick == null)
                pick = tryPick(eligible, recentMeals, usedThisWeek, season, null, rules.effectiveSeasonMatch(), false);
            if (pick == null)
                pick = tryPick(eligible, recentMeals, usedThisWeek, season, null, false, false);
            if (pick == null)
                pick = tryPick(eligible, Set.of(), usedThisWeek, season, null, false, false);

            if (pick != null) {
                result.put(dateStr, pick);
                usedThisWeek.add(pick);
            }
        }

        return result;
    }

    private String tryPick(List<Meal> meals, Set<String> recentMeals, Set<String> usedThisWeek,
                            String season, Map<String, Object> dayWeather,
                            boolean seasonMatch, boolean weatherMatch) {
        List<String> eligible = meals.stream()
                .filter(m -> m.getName() != null && !m.getName().isBlank())
                .filter(m -> !recentMeals.contains(m.getName()))
                .filter(m -> !usedThisWeek.contains(m.getName()))
                .filter(m -> {
                    if (!seasonMatch) return true;
                    if (m.getSeasons() == null || m.getSeasons().isBlank()) return true;
                    return Arrays.asList(m.getSeasons().split(",")).contains(season);
                })
                .filter(m -> {
                    if (!weatherMatch || dayWeather == null) return true;
                    Object high = dayWeather.get("high");
                    if (high == null) return true;
                    int highTemp = ((Number) high).intValue();
                    if (m.getMaxTemp() != null && highTemp > m.getMaxTemp()) return false;
                    if (m.getMinTemp() != null && highTemp < m.getMinTemp()) return false;
                    return true;
                })
                .map(Meal::getName)
                .collect(Collectors.toList());

        if (eligible.isEmpty()) return null;
        Collections.shuffle(eligible);
        return eligible.get(0);
    }

    private boolean isWeeknight(LocalDate date) {
        java.time.DayOfWeek dow = date.getDayOfWeek();
        return dow == java.time.DayOfWeek.MONDAY || dow == java.time.DayOfWeek.TUESDAY
                || dow == java.time.DayOfWeek.WEDNESDAY || dow == java.time.DayOfWeek.THURSDAY
                || dow == java.time.DayOfWeek.FRIDAY;
    }

    private String getSeason(LocalDate date) {
        int m = date.getMonthValue();
        if (m >= 3 && m <= 5) return "SPRING";
        if (m >= 6 && m <= 8) return "SUMMER";
        if (m >= 9 && m <= 11) return "FALL";
        return "WINTER";
    }
}
