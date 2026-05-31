package com.menuplanner.controller;

import com.menuplanner.repository.MealRepository;
import com.menuplanner.security.AppUserDetails;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/meals")
public class MealController {

    private final MealRepository mealRepository;

    public MealController(MealRepository mealRepository) {
        this.mealRepository = mealRepository;
    }

    @GetMapping("/check")
    public Map<String, Boolean> checkName(@RequestParam String name,
                                          @AuthenticationPrincipal AppUserDetails userDetails) {
        String trimmed = name.trim();
        boolean existsInHousehold = mealRepository.findByNameAndHousehold(trimmed, userDetails.getHousehold()).isPresent();
        boolean existsShared = mealRepository.findFirstByNameAndSharedTrue(trimmed).isPresent();
        return Map.of("existsInHousehold", existsInHousehold, "existsShared", existsShared);
    }
}
