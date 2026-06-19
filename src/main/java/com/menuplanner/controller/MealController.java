package com.menuplanner.controller;

import com.menuplanner.domain.*;
import com.menuplanner.repository.*;
import com.menuplanner.security.AppUserDetails;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/meals")
public class MealController {

    private static final Logger log = LoggerFactory.getLogger(MealController.class);

    private final MealRepository mealRepository;
    private final MenuEntryRepository menuEntryRepository;
    private final RecipeRepository recipeRepository;
    private final IngredientRepository ingredientRepository;
    private final SideRepository sideRepository;
    private final CookbookRepository cookbookRepository;

    public MealController(MealRepository mealRepository, MenuEntryRepository menuEntryRepository,
                          RecipeRepository recipeRepository, IngredientRepository ingredientRepository,
                          SideRepository sideRepository, CookbookRepository cookbookRepository) {
        this.mealRepository = mealRepository;
        this.menuEntryRepository = menuEntryRepository;
        this.recipeRepository = recipeRepository;
        this.ingredientRepository = ingredientRepository;
        this.sideRepository = sideRepository;
        this.cookbookRepository = cookbookRepository;
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

    @GetMapping("/ingredient-suggestions")
    public List<String> ingredientSuggestions(@RequestParam(defaultValue = "") String q,
                                               @AuthenticationPrincipal AppUserDetails userDetails) {
        return ingredientRepository
                .findForHouseholdWithQuery(userDetails.getHousehold(), q)
                .stream().map(Ingredient::getName).collect(Collectors.toList());
    }

    @GetMapping("/side-suggestions")
    public List<String> sideSuggestions(@RequestParam(defaultValue = "") String q,
                                         @AuthenticationPrincipal AppUserDetails userDetails) {
        return sideRepository
                .findByHouseholdAndNameContainingIgnoreCaseOrderByName(userDetails.getHousehold(), q)
                .stream().map(Side::getName).collect(Collectors.toList());
    }

    @PostMapping
    public Map<String, Object> createMeal(@RequestBody MealRequest req,
                                          @AuthenticationPrincipal AppUserDetails userDetails) {
        Meal meal = new Meal();
        meal.setName(req.name().trim());
        meal.setHousehold(userDetails.getHousehold());
        applyBasicFields(meal, req);
        meal = mealRepository.save(meal);
        applyRecipeAndSides(meal, req, userDetails.getHousehold());
        return toResponse(meal);
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
        applyBasicFields(meal, req);
        meal = mealRepository.save(meal);
        applyRecipeAndSides(meal, req, userDetails.getHousehold());
        return toResponse(meal);
    }

    @PatchMapping("/{id}/cookbook")
    public Map<String, Object> linkCookbook(@PathVariable Long id,
                                             @RequestBody Map<String, Object> body,
                                             @AuthenticationPrincipal AppUserDetails userDetails) {
        Meal meal = mealRepository.findByIdForHousehold(id, userDetails.getHousehold().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meal not found"));
        Object rawId = body.get("cookbookId");
        if (rawId == null) {
            meal.setCookbook(null);
        } else {
            Long cookbookId = ((Number) rawId).longValue();
            Cookbook cookbook = cookbookRepository.findById(cookbookId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cookbook not found"));
            meal.setCookbook(cookbook);
        }
        mealRepository.save(meal);
        Cookbook cb = meal.getCookbook();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("cookbookId", cb != null ? cb.getId() : null);
        result.put("cookbookName", cb != null ? cb.getName() : null);
        return result;
    }

    @PatchMapping("/{id}/recipe")
    public Map<String, Object> linkRecipe(@PathVariable Long id,
                                           @RequestBody Map<String, Object> body,
                                           @AuthenticationPrincipal AppUserDetails userDetails) {
        Meal meal = mealRepository.findByIdForHousehold(id, userDetails.getHousehold().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meal not found"));

        Object rawId = body.get("recipeId");
        if (rawId == null) {
            recipeRepository.findByMeal(meal).ifPresent(r -> { r.setMeal(null); recipeRepository.save(r); });
            meal.setRecipe(null);
            mealRepository.save(meal);
            return Map.of("recipeId", "", "recipeName", "", "cookbookName", "");
        }

        Long recipeId = ((Number) rawId).longValue();
        Recipe recipe = recipeRepository.findByIdForHousehold(recipeId, userDetails.getHousehold().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipe not found"));

        if (recipe.getMeal() != null && !recipe.getMeal().getId().equals(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "\"" + recipe.getName() + "\" is already linked to \"" + recipe.getMeal().getName() + "\".");
        }

        recipeRepository.findByMeal(meal).ifPresent(r -> {
            if (!r.getId().equals(recipeId)) { r.setMeal(null); recipeRepository.save(r); }
        });

        recipe.setMeal(meal);
        meal.setRecipe(recipe);
        recipeRepository.save(recipe);
        mealRepository.save(meal);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("recipeId", recipe.getId());
        result.put("recipeName", recipe.getName());
        result.put("cookbookName", recipe.getCookbook() != null ? recipe.getCookbook().getName() : null);
        return result;
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

    private void applyBasicFields(Meal meal, MealRequest req) {
        meal.setRecipeLink(req.recipeLink());
        meal.setNotes(req.notes());
        meal.setShared(Boolean.TRUE.equals(req.shared()));
        meal.setMinTemp(req.minTemp());
        meal.setMaxTemp(req.maxTemp());
        meal.setSeasons(req.seasons() == null || req.seasons().isEmpty() ? null
                : req.seasons().stream().filter(s -> s != null && !s.isBlank()).collect(Collectors.joining(",")));
        if (req.cookbookId() != null) {
            meal.setCookbook(cookbookRepository.findById(req.cookbookId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cookbook not found")));
        } else {
            meal.setCookbook(null);
        }
    }

    private void applyRecipeAndSides(Meal meal, MealRequest req, Household household) {
        RecipeRequest recipeReq = req.recipe();
        if (recipeReq != null && recipeReq.name() != null && !recipeReq.name().isBlank()) {
            Recipe recipe = recipeRepository.findByMeal(meal).orElse(new Recipe());
            recipe.setMeal(meal);
            recipe.setName(recipeReq.name().trim());
            recipe.setInstructions(recipeReq.instructions());
            List<Ingredient> ingredients = new ArrayList<>();
            if (recipeReq.ingredients() != null) {
                for (String ingName : recipeReq.ingredients()) {
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
            Recipe saved = recipeRepository.save(recipe);
            meal.setRecipe(saved);
        } else {
            recipeRepository.findByMeal(meal).ifPresent(r -> {
                meal.setRecipe(null);
                recipeRepository.delete(r);
            });
        }

        List<Side> sides = new ArrayList<>();
        if (req.sides() != null) {
            for (String sideName : req.sides()) {
                if (sideName == null || sideName.isBlank()) continue;
                String trimmed = sideName.trim();
                Side side = sideRepository.findByNameIgnoreCaseAndHousehold(trimmed, household)
                        .orElseGet(() -> {
                            Side newSide = new Side();
                            newSide.setName(trimmed);
                            newSide.setHousehold(household);
                            return sideRepository.save(newSide);
                        });
                sides.add(side);
            }
        }
        meal.setSides(sides);
        mealRepository.save(meal);
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
        Recipe recipe = m.getRecipe();
        if (recipe != null) {
            Map<String, Object> recipeMap = new LinkedHashMap<>();
            recipeMap.put("id", recipe.getId());
            recipeMap.put("name", recipe.getName());
            recipeMap.put("instructions", recipe.getInstructions());
            recipeMap.put("ingredients", recipe.getIngredients().stream()
                    .map(Ingredient::getName).collect(Collectors.toList()));
            resp.put("recipe", recipeMap);
        } else {
            resp.put("recipe", null);
        }
        resp.put("sides", m.getSides().stream().map(Side::getName).collect(Collectors.toList()));
        Cookbook cookbook = m.getCookbook();
        resp.put("cookbookId", cookbook != null ? cookbook.getId() : null);
        resp.put("cookbookName", cookbook != null ? cookbook.getName() : null);
        return resp;
    }

    record RecipeRequest(String name, String instructions, List<String> ingredients) {}

    record MealRequest(String name, String recipeLink, String notes, Boolean shared,
                       Integer minTemp, Integer maxTemp, List<String> seasons,
                       RecipeRequest recipe, List<String> sides, Long cookbookId) {}
}
