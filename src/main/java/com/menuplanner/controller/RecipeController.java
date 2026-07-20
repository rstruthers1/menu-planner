package com.menuplanner.controller;

import com.menuplanner.domain.*;
import com.menuplanner.repository.*;
import com.menuplanner.security.AppUserDetails;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/recipes")
public class RecipeController {

    private final RecipeRepository recipeRepository;
    private final IngredientRepository ingredientRepository;
    private final MealRepository mealRepository;
    private final CookbookRepository cookbookRepository;

    public RecipeController(RecipeRepository recipeRepository, IngredientRepository ingredientRepository,
                            MealRepository mealRepository, CookbookRepository cookbookRepository) {
        this.recipeRepository = recipeRepository;
        this.ingredientRepository = ingredientRepository;
        this.mealRepository = mealRepository;
        this.cookbookRepository = cookbookRepository;
    }

    @GetMapping
    public List<Map<String, Object>> getRecipes(@AuthenticationPrincipal AppUserDetails userDetails) {
        return recipeRepository.findAllForHousehold(userDetails.getHousehold())
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @PostMapping
    public Map<String, Object> createRecipe(@RequestBody RecipeRequest req,
                                            @AuthenticationPrincipal AppUserDetails userDetails) {
        Recipe recipe = new Recipe();
        recipe.setHousehold(userDetails.getHousehold());
        applyFields(recipe, req, userDetails.getHousehold());
        return toResponse(recipeRepository.save(recipe));
    }

    @PutMapping("/{id}")
    public Map<String, Object> updateRecipe(@PathVariable Long id, @RequestBody RecipeRequest req,
                                            @AuthenticationPrincipal AppUserDetails userDetails) {
        Recipe recipe = recipeRepository.findByIdForHousehold(id, userDetails.getHousehold().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipe not found"));
        applyFields(recipe, req, userDetails.getHousehold());
        return toResponse(recipeRepository.save(recipe));
    }

    @DeleteMapping("/{id}")
    public void deleteRecipe(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails userDetails) {
        Recipe recipe = recipeRepository.findByIdForHousehold(id, userDetails.getHousehold().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipe not found"));
        recipe.setMeal(null);
        recipeRepository.delete(recipeRepository.save(recipe));
    }

    private void applyFields(Recipe recipe, RecipeRequest req, Household household) {
        recipe.setName(req.name().trim());
        recipe.setServings(req.servings());
        recipe.setInstructions(req.instructions());
        recipe.setSourceUrl(req.sourceUrl() != null && !req.sourceUrl().isBlank() ? req.sourceUrl().trim() : null);
        recipe.setExtendedData(req.extendedData() != null && !req.extendedData().isBlank() ? req.extendedData().trim() : null);

        List<Ingredient> ingredients = new ArrayList<>();
        if (req.ingredients() != null) {
            for (String ingName : req.ingredients()) {
                if (ingName == null || ingName.isBlank()) continue;
                String trimmed = ingName.trim();
                Ingredient ing = ingredientRepository.findByNameIgnoreCaseAndHousehold(trimmed, household)
                        .or(() -> ingredientRepository.findByNameIgnoreCaseAndHouseholdIsNull(trimmed))
                        .orElseGet(() -> {
                            Ingredient newIng = new Ingredient();
                            newIng.setName(trimmed);
                            newIng.setHousehold(household);
                            return ingredientRepository.save(newIng);
                        });
                ingredients.add(ing);
            }
        }
        recipe.setIngredients(ingredients);

        if (req.mealId() != null) {
            Meal meal = mealRepository.findByIdForHousehold(req.mealId(), household.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meal not found"));
            Optional<Recipe> existingRecipe = recipeRepository.findByMeal(meal);
            if (existingRecipe.isPresent() && !existingRecipe.get().getId().equals(recipe.getId())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "\"" + meal.getName() + "\" already has a linked recipe. Remove it first.");
            }
            recipe.setMeal(meal);
        } else {
            recipe.setMeal(null);
        }

        if (req.cookbookId() != null) {
            Cookbook cookbook = cookbookRepository.findById(req.cookbookId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cookbook not found"));
            recipe.setCookbook(cookbook);
        } else {
            recipe.setCookbook(null);
        }
    }

    private Map<String, Object> toResponse(Recipe r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("name", r.getName());
        m.put("servings", r.getServings());
        m.put("sourceUrl", r.getSourceUrl());
        m.put("instructions", r.getInstructions());
        m.put("ingredients", r.getIngredients().stream().map(Ingredient::getName).collect(Collectors.toList()));
        m.put("extendedData", r.getExtendedData());
        Meal meal = r.getMeal();
        m.put("mealId", meal != null ? meal.getId() : null);
        m.put("mealName", meal != null ? meal.getName() : null);
        Cookbook cookbook = r.getCookbook();
        m.put("cookbookId", cookbook != null ? cookbook.getId() : null);
        m.put("cookbookName", cookbook != null ? cookbook.getName() : null);
        return m;
    }

    record RecipeRequest(String name, Integer servings, String instructions,
                         List<String> ingredients, Long mealId, Long cookbookId, String sourceUrl,
                         String extendedData) {}
}
