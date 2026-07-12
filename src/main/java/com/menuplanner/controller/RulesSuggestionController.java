package com.menuplanner.controller;

import com.menuplanner.security.AppUserDetails;
import com.menuplanner.service.RulesSuggestionService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import java.util.Map;

@RestController
@RequestMapping("/api/suggest-meals/rules")
public class RulesSuggestionController {

    private final RulesSuggestionService service;

    public RulesSuggestionController(RulesSuggestionService service) {
        this.service = service;
    }

    @PostMapping
    public Map<String, String> suggest(@RequestBody SuggestionRequest request,
                                       @AuthenticationPrincipal AppUserDetails userDetails) {
        return service.suggest(
                userDetails.getHousehold(),
                request.weekStart(),
                request.existingMeals(),
                request.weather(),
                request.rules() != null ? request.rules() : new RulesSuggestionService.RulesConfig(14, true, true, List.of()),
                request.targetDate()
        );
    }

    record SuggestionRequest(
            String weekStart,
            Map<String, String> existingMeals,
            Map<String, Map<String, Object>> weather,
            RulesSuggestionService.RulesConfig rules,
            String targetDate
    ) {}
}
