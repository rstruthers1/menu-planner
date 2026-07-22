package com.menuplanner.controller;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.ContentBlock;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.Model;
import com.menuplanner.domain.MenuEntry;
import com.menuplanner.domain.Recipe;
import com.menuplanner.repository.MenuEntryRepository;
import com.menuplanner.repository.RecipeRepository;
import com.menuplanner.security.AppUserDetails;
import org.json.JSONArray;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;

@RestController
@RequestMapping("/api/shopping-list")
public class ShoppingListController {

    private static final Logger log = LoggerFactory.getLogger(ShoppingListController.class);

    private static final List<String> CATEGORY_ORDER = List.of(
            "Produce", "Meat & Seafood", "Dairy & Eggs", "Bread & Bakery",
            "Canned & Dry Goods", "Frozen", "Condiments & Sauces",
            "Spices & Seasonings", "Oils & Vinegars", "Baking", "Beverages", "Other"
    );

    private final MenuEntryRepository menuEntryRepository;
    private final RecipeRepository recipeRepository;

    @Value("${anthropic.api-key:}")
    private String anthropicApiKey;

    public ShoppingListController(MenuEntryRepository menuEntryRepository, RecipeRepository recipeRepository) {
        this.menuEntryRepository = menuEntryRepository;
        this.recipeRepository = recipeRepository;
    }

    record IngItem(String ingredient, String recipe) {}

    @GetMapping
    public Map<String, Object> getShoppingList(@RequestParam String start,
                                               @AuthenticationPrincipal AppUserDetails userDetails) {
        LocalDate startDate;
        try {
            startDate = LocalDate.parse(start);
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date: " + start);
        }
        LocalDate endDate = startDate.plusDays(6);

        List<MenuEntry> entries = menuEntryRepository.findByMealDateBetweenAndHousehold(
                startDate, endDate, userDetails.getHousehold());

        List<IngItem> items = new ArrayList<>();
        List<String> mealsWithoutRecipe = new ArrayList<>();
        List<String> mealsWithoutIngredients = new ArrayList<>();
        List<String> guessedMeals = new ArrayList<>();

        for (MenuEntry entry : entries) {
            if (entry.getMeal() == null) continue;
            String mealName = entry.getMeal().getName();
            if (mealName == null || mealName.isBlank()) continue;

            Recipe recipe = recipeRepository.findByMeal(entry.getMeal()).orElse(null);
            if (recipe == null) {
                // No recipe — check if meal has its own ingredients
                List<com.menuplanner.domain.Ingredient> mealIngs = entry.getMeal().getIngredients();
                if (!mealIngs.isEmpty()) {
                    for (var ing : mealIngs) {
                        if (ing.getName() != null && !ing.getName().isBlank()) {
                            items.add(new IngItem(ing.getName().trim(), mealName));
                        }
                    }
                } else {
                    mealsWithoutRecipe.add(mealName);
                }
                continue;
            }
            if (recipe.getIngredients().isEmpty()) {
                mealsWithoutIngredients.add(mealName);
                continue;
            }
            for (var ing : recipe.getIngredients()) {
                if (ing.getName() != null && !ing.getName().isBlank()) {
                    items.add(new IngItem(ing.getName().trim(), mealName));
                }
            }
        }

        // For meals with no recipe, try guessing ingredients from the meal name
        if (!mealsWithoutRecipe.isEmpty()) {
            List<IngItem> guessed = guessIngredientsFromNames(mealsWithoutRecipe);
            if (!guessed.isEmpty()) {
                items.addAll(guessed);
                guessedMeals.addAll(mealsWithoutRecipe);
                mealsWithoutRecipe.removeAll(guessedMeals);
            }
        }

        if (items.isEmpty()) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("categories", List.of());
            result.put("mealsWithoutRecipe", mealsWithoutRecipe);
            result.put("mealsWithoutIngredients", mealsWithoutIngredients);
            result.put("guessedMeals", guessedMeals);
            return result;
        }

        List<Map<String, Object>> categories = categorizeWithClaude(items);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("categories", categories);
        result.put("mealsWithoutRecipe", mealsWithoutRecipe);
        result.put("mealsWithoutIngredients", mealsWithoutIngredients);
        result.put("guessedMeals", guessedMeals);
        return result;
    }

    private List<IngItem> guessIngredientsFromNames(List<String> mealNames) {
        if (anthropicApiKey == null || anthropicApiKey.isBlank()) return List.of();
        StringBuilder sb = new StringBuilder();
        for (String name : mealNames) sb.append("- ").append(name).append("\n");
        String prompt = "For each meal name below, list the main ingredients someone would need to buy at the grocery store. "
                + "Strip cooking methods from ingredient names (e.g. 'Grilled Pork Loin' → 'Pork Loin', 'Scrambled Eggs' → 'Eggs'). "
                + "No quantities needed — just the ingredient names.\n\n"
                + "Return ONLY valid JSON array, no markdown:\n"
                + "[{\"meal\": \"Meal Name\", \"ingredients\": [\"Ingredient 1\", \"Ingredient 2\"]}]\n\n"
                + "Meals:\n" + sb;
        try {
            AnthropicClient client = AnthropicOkHttpClient.builder().apiKey(anthropicApiKey).build();
            Message response = client.messages().create(
                    MessageCreateParams.builder()
                            .model(Model.CLAUDE_HAIKU_4_5_20251001)
                            .maxTokens(600)
                            .addUserMessage(prompt)
                            .build()
            );
            String raw = response.content().stream()
                    .filter(ContentBlock::isText)
                    .map(b -> b.asText().text())
                    .findFirst().orElse("[]").trim();
            if (raw.startsWith("```")) raw = raw.replaceAll("^```[a-z]*\\n?", "").replaceAll("```$", "").trim();
            JSONArray arr = new JSONArray(raw);
            List<IngItem> result = new ArrayList<>();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.optJSONObject(i);
                if (obj == null) continue;
                String meal = obj.optString("meal", "").trim();
                JSONArray ings = obj.optJSONArray("ingredients");
                if (ings == null || meal.isEmpty()) continue;
                for (int j = 0; j < ings.length(); j++) {
                    String ing = ings.optString(j, "").trim();
                    if (!ing.isEmpty()) result.add(new IngItem(ing, meal));
                }
            }
            return result;
        } catch (Exception e) {
            log.warn("Shopping list: ingredient guessing from meal name failed: {}", e.getMessage());
            return List.of();
        }
    }

    private List<Map<String, Object>> categorizeWithClaude(List<IngItem> items) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < items.size(); i++) {
            sb.append(i + 1).append(". ").append(items.get(i).ingredient()).append("\n");
        }

        String prompt = """
                You are a grocery shopping assistant. Categorize this numbered ingredient list into standard grocery store sections.

                Category definitions — use the BEST fit, and use "Other" only as a last resort:
                - Produce: all fresh vegetables, fruits, herbs, and greens — including onions, green onions, scallions, garlic, potatoes, peppers, lettuce, apples, citrus, corn, ginger root, mandarin oranges, etc.
                - Meat & Seafood: raw or cooked meat, poultry, fish, seafood
                - Dairy & Eggs: milk, cheese, butter, yogurt, cream, eggs
                - Bread & Bakery: bread, rolls, buns, tortillas, pastries
                - Canned & Dry Goods: canned broth, canned tomatoes, rice, pasta, nuts, dried fruit, water chestnuts, canned beans
                - Frozen: items sold in the freezer aisle
                - Condiments & Sauces: soy sauce, hoisin, hot sauce, ketchup, mustard, peanut butter, salad dressing, vinaigrette, pomegranate juice (as condiment), chili sauce
                - Spices & Seasonings: salt, pepper, dried spices, garlic powder, onion powder, ginger powder, seasoning blends, kosher salt
                - Oils & Vinegars: cooking oils (olive oil, sesame oil, canola oil, peanut oil), vinegar (rice vinegar, white wine vinegar, balsamic)
                - Baking: flour, sugar, baking powder, cornstarch, vanilla, cocoa, honey, maple syrup
                - Beverages: drinks served as beverages
                - Other: only for items that truly do not fit any category above

                Return a JSON array. Each ingredient must appear exactly once. Use the exact category names above.

                Format:
                [
                  { "category": "Produce", "indices": [1, 3, 5] },
                  { "category": "Meat & Seafood", "indices": [2, 4] }
                ]

                Indices are 1-based. Return only the JSON array, no markdown, no explanation.

                Ingredients:
                """ + sb;

        try {
            AnthropicClient client = AnthropicOkHttpClient.builder().apiKey(anthropicApiKey).build();
            Message response = client.messages().create(
                    MessageCreateParams.builder()
                            .model(Model.CLAUDE_HAIKU_4_5_20251001)
                            .maxTokens(1000)
                            .addUserMessage(prompt)
                            .build()
            );
            String raw = response.content().stream()
                    .filter(ContentBlock::isText)
                    .map(b -> b.asText().text())
                    .findFirst()
                    .orElse("[]");
            raw = raw.trim();
            if (raw.startsWith("```")) {
                raw = raw.replaceAll("^```[a-z]*\\n?", "").replaceAll("```$", "").trim();
            }
            return buildCategories(new JSONArray(raw), items);
        } catch (Exception e) {
            log.warn("Shopping list: Claude categorization failed: {}", e.getMessage());
            // Fallback: single uncategorized list
            List<Map<String, Object>> fallback = new ArrayList<>();
            Map<String, Object> cat = new LinkedHashMap<>();
            cat.put("name", "All Ingredients");
            cat.put("items", toItemList(items, null));
            fallback.add(cat);
            return fallback;
        }
    }

    private List<Map<String, Object>> buildCategories(JSONArray arr, List<IngItem> items) {
        Set<Integer> assigned = new HashSet<>();
        // LinkedHashMap preserves Claude's category order before we re-sort by CATEGORY_ORDER;
        // using it also naturally merges duplicate category names from Claude
        Map<String, List<Integer>> byCategory = new LinkedHashMap<>();

        for (int i = 0; i < arr.length(); i++) {
            JSONObject catObj = arr.optJSONObject(i);
            if (catObj == null) continue;
            String catName = catObj.optString("category", "Other");
            JSONArray indices = catObj.optJSONArray("indices");
            if (indices == null || indices.isEmpty()) continue;

            List<Integer> catIdx = byCategory.computeIfAbsent(catName, k -> new ArrayList<>());
            for (int j = 0; j < indices.length(); j++) {
                int idx = indices.optInt(j, 0) - 1; // 1-based → 0-based
                if (idx >= 0 && idx < items.size() && !assigned.contains(idx)) {
                    assigned.add(idx);
                    catIdx.add(idx);
                }
            }
        }

        List<Map<String, Object>> categories = new ArrayList<>();
        for (var entry : byCategory.entrySet()) {
            if (entry.getValue().isEmpty()) continue;
            List<Integer> idxList = entry.getValue();
            idxList.sort(Comparator.comparing(idx -> ingredientSortKey(items.get(idx).ingredient())));
            Map<String, Object> cat = new LinkedHashMap<>();
            cat.put("name", entry.getKey());
            cat.put("items", toItemList(items, idxList));
            categories.add(cat);
        }

        // Any unassigned items go to Other
        List<Integer> unassignedIdx = new ArrayList<>();
        for (int i = 0; i < items.size(); i++) {
            if (!assigned.contains(i)) unassignedIdx.add(i);
        }
        if (!unassignedIdx.isEmpty()) {
            unassignedIdx.sort(Comparator.comparing(idx -> ingredientSortKey(items.get(idx).ingredient())));
            List<Map<String, Object>> unassignedItems = toItemList(items, unassignedIdx);
            categories.stream()
                    .filter(c -> "Other".equals(c.get("name")))
                    .findFirst()
                    .ifPresentOrElse(
                            c -> ((List<Map<String, Object>>) c.get("items")).addAll(unassignedItems),
                            () -> {
                                Map<String, Object> other = new LinkedHashMap<>();
                                other.put("name", "Other");
                                other.put("items", unassignedItems);
                                categories.add(other);
                            }
                    );
        }

        categories.sort(Comparator.comparingInt(c -> {
            int pos = CATEGORY_ORDER.indexOf(c.get("name"));
            return pos < 0 ? CATEGORY_ORDER.size() : pos;
        }));

        return categories;
    }

    private String ingredientSortKey(String ingredient) {
        String s = ingredient.toLowerCase().trim();
        // strip leading quantity: numbers, fractions, unicode fraction chars
        s = s.replaceAll("^[\\d\\s/½¼¾⅓⅔⅛⅜⅝⅞]+", "").trim();
        // strip leading unit word
        s = s.replaceAll("^(cups?|tbsps?|tsps?|tablespoons?|teaspoons?|oz|lbs?|pounds?|grams?|g|kg|ml|liters?|cans?|pkgs?|packages?|bunches?|bunch|cloves?|inches?|slices?|pieces?|sticks?|stalks?|heads?|ears?|jars?)\\b\\s*", "").trim();
        // strip leading common prep adjectives
        s = s.replaceAll("^(diced|chopped|sliced|minced|grated|shredded|crushed|ground|fresh|dried|frozen|canned|cooked|raw|large|medium|small|whole)\\s+", "").trim();
        // strip parentheticals and comma-clauses — these are prep notes, not the ingredient name
        // e.g. "onion (finely diced)" → "onion", "onion, cut into slices" → "onion"
        s = s.replaceAll("[,(].*$", "").trim();
        // reverse word order so "gala apple" → "apple gala" and "green apple" → "apple green",
        // keeping all varieties of the same ingredient adjacent
        String[] words = s.split("\\s+");
        StringBuilder reversed = new StringBuilder();
        for (int i = words.length - 1; i >= 0; i--) {
            if (!reversed.isEmpty()) reversed.append(' ');
            reversed.append(words[i]);
        }
        return reversed.toString();
    }

    private List<Map<String, Object>> toItemList(List<IngItem> items, List<Integer> indices) {
        List<Map<String, Object>> result = new ArrayList<>();
        Iterable<Integer> iter = indices != null ? indices : range(items.size());
        for (int idx : iter) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ingredient", items.get(idx).ingredient());
            m.put("recipe", items.get(idx).recipe());
            result.add(m);
        }
        return result;
    }

    private Iterable<Integer> range(int size) {
        List<Integer> list = new ArrayList<>(size);
        for (int i = 0; i < size; i++) list.add(i);
        return list;
    }
}
