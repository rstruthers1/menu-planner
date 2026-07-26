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
import com.menuplanner.repository.PantryRepository;
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
import java.util.stream.Collectors;

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
    private final PantryRepository pantryRepository;

    @Value("${anthropic.api-key:}")
    private String anthropicApiKey;

    public ShoppingListController(MenuEntryRepository menuEntryRepository,
                                   RecipeRepository recipeRepository,
                                   PantryRepository pantryRepository) {
        this.menuEntryRepository = menuEntryRepository;
        this.recipeRepository = recipeRepository;
        this.pantryRepository = pantryRepository;
    }

    record IngItem(String ingredient, String recipe, boolean pantryMatch) {}

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

        // Load pantry once; build a normalized key set for matching
        Set<String> pantryKeys = pantryRepository.findByHouseholdOrderByName(userDetails.getHousehold())
                .stream()
                .map(p -> normalize(p.getName()))
                .filter(k -> !k.isBlank())
                .collect(Collectors.toSet());

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
                List<com.menuplanner.domain.Ingredient> mealIngs = entry.getMeal().getIngredients();
                if (!mealIngs.isEmpty()) {
                    for (var ing : mealIngs) {
                        if (ing.getName() != null && !ing.getName().isBlank()) {
                            String name = ing.getName().trim();
                            items.add(new IngItem(name, mealName, matchesPantry(name, pantryKeys)));
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
                    String name = ing.getName().trim();
                    items.add(new IngItem(name, mealName, matchesPantry(name, pantryKeys)));
                }
            }
        }

        if (!mealsWithoutRecipe.isEmpty()) {
            List<IngItem> guessed = guessIngredientsFromNames(mealsWithoutRecipe, pantryKeys);
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

    // Normalize an ingredient string to its base noun phrase for pantry matching and sort keys.
    // Strips leading quantities, units, prep adjectives, and trailing parentheticals/comma-clauses.
    private String normalize(String ingredient) {
        String s = ingredient.toLowerCase().trim();
        s = s.replaceAll("^[\\d\\s/½¼¾⅓⅔⅛⅜⅝⅞]+", "").trim();
        s = s.replaceAll("^(cups?|tbsps?|tsps?|tablespoons?|teaspoons?|oz|lbs?|pounds?|grams?|g|kg|ml|liters?|cans?|pkgs?|packages?|bunches?|bunch|cloves?|inches?|slices?|pieces?|sticks?|stalks?|heads?|ears?|jars?)\\b\\s*", "").trim();
        s = s.replaceAll("^(diced|chopped|sliced|minced|grated|shredded|crushed|ground|fresh|dried|frozen|canned|cooked|raw|large|medium|small|whole)\\s+", "").trim();
        s = s.replaceAll("[,(].*$", "").trim();
        return s;
    }

    private String ingredientSortKey(String ingredient) {
        String s = normalize(ingredient);
        String[] words = s.split("\\s+");
        StringBuilder reversed = new StringBuilder();
        for (int i = words.length - 1; i >= 0; i--) {
            if (!reversed.isEmpty()) reversed.append(' ');
            reversed.append(words[i]);
        }
        return reversed.toString();
    }

    // Check if a normalized pantry key appears as a word-boundary match within the ingredient.
    private boolean matchesPantry(String ingredient, Set<String> pantryKeys) {
        if (pantryKeys.isEmpty()) return false;
        String key = normalize(ingredient);
        for (String pk : pantryKeys) {
            if (pk.isBlank()) continue;
            if (key.equals(pk)) return true;
            if (key.startsWith(pk + " ")) return true;
            if (key.endsWith(" " + pk)) return true;
            if (key.contains(" " + pk + " ")) return true;
        }
        return false;
    }

    private List<IngItem> guessIngredientsFromNames(List<String> mealNames, Set<String> pantryKeys) {
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
                    if (!ing.isEmpty()) result.add(new IngItem(ing, meal, matchesPantry(ing, pantryKeys)));
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
                            .maxTokens(1500)
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
        Map<String, List<Integer>> byCategory = new LinkedHashMap<>();

        for (int i = 0; i < arr.length(); i++) {
            JSONObject catObj = arr.optJSONObject(i);
            if (catObj == null) continue;
            String catName = catObj.optString("category", "Other");
            JSONArray indices = catObj.optJSONArray("indices");
            if (indices == null || indices.isEmpty()) continue;

            List<Integer> catIdx = byCategory.computeIfAbsent(catName, k -> new ArrayList<>());
            for (int j = 0; j < indices.length(); j++) {
                int idx = indices.optInt(j, 0) - 1;
                if (idx >= 0 && idx < items.size() && !assigned.contains(idx)) {
                    assigned.add(idx);
                    catIdx.add(idx);
                }
            }
        }

        // Items Claude didn't assign: keyword fallback before defaulting to Other
        for (int i = 0; i < items.size(); i++) {
            if (assigned.contains(i)) continue;
            String guessed = guessCategory(items.get(i).ingredient());
            byCategory.computeIfAbsent(guessed, k -> new ArrayList<>()).add(i);
            assigned.add(i);
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

        categories.sort(Comparator.comparingInt(c -> {
            int pos = CATEGORY_ORDER.indexOf(c.get("name"));
            return pos < 0 ? CATEGORY_ORDER.size() : pos;
        }));

        return categories;
    }

    private static final Map<String, String> KEYWORD_CATEGORIES;
    static {
        Map<String, String> m = new LinkedHashMap<>();
        // Produce — vegetables
        for (String k : List.of("potato", "potatoes", "sweet potato", "yam", "carrot", "carrots",
                "onion", "onions", "green onion", "scallion", "leek", "shallot",
                "garlic", "ginger", "ginger root",
                "tomato", "tomatoes", "cherry tomato",
                "pepper", "peppers", "bell pepper", "jalapeño", "serrano", "poblano",
                "corn", "corn on the cob", "zucchini", "squash", "pumpkin", "eggplant",
                "broccoli", "cauliflower", "asparagus", "artichoke", "celery",
                "mushroom", "mushrooms", "beet", "beets", "radish", "turnip", "parsnip",
                "cucumber", "avocado", "spinach", "kale", "lettuce", "romaine",
                "cabbage", "bok choy", "arugula", "mixed greens",
                // Produce — fruits
                "apple", "apples", "pear", "orange", "lemon", "lime", "grapefruit",
                "banana", "grape", "grapes", "strawberry", "blueberry", "raspberry",
                "blackberry", "mango", "pineapple", "watermelon", "cantaloupe", "peach",
                "plum", "cherry", "cherries", "kiwi", "mandarin", "clementine", "fig",
                // Produce — herbs
                "basil", "cilantro", "parsley", "mint", "thyme", "rosemary", "dill",
                "chives", "sage", "oregano leaf")) {
            m.put(k, "Produce");
        }
        // Meat & Seafood
        for (String k : List.of("chicken", "beef", "pork", "steak", "turkey", "lamb",
                "salmon", "tuna", "shrimp", "cod", "tilapia", "halibut", "crab", "lobster",
                "bratwurst", "sausage", "bacon", "ham", "brats")) {
            m.put(k, "Meat & Seafood");
        }
        // Dairy & Eggs
        for (String k : List.of("milk", "butter", "cream", "egg", "eggs",
                "cheese", "cheddar", "mozzarella", "parmesan", "ricotta", "yogurt")) {
            m.put(k, "Dairy & Eggs");
        }
        // Bread & Bakery
        for (String k : List.of("bread", "bun", "buns", "roll", "rolls", "tortilla",
                "bagel", "pita", "naan")) {
            m.put(k, "Bread & Bakery");
        }
        KEYWORD_CATEGORIES = Collections.unmodifiableMap(m);
    }

    private String guessCategory(String ingredient) {
        String norm = normalize(ingredient);
        // Direct match first, then check if norm contains a keyword
        if (KEYWORD_CATEGORIES.containsKey(norm)) return KEYWORD_CATEGORIES.get(norm);
        for (var entry : KEYWORD_CATEGORIES.entrySet()) {
            if (norm.contains(entry.getKey())) return entry.getValue();
        }
        return "Other";
    }

    private List<Map<String, Object>> toItemList(List<IngItem> items, List<Integer> indices) {
        List<Map<String, Object>> result = new ArrayList<>();
        Iterable<Integer> iter = indices != null ? indices : range(items.size());
        for (int idx : iter) {
            IngItem item = items.get(idx);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ingredient", item.ingredient());
            m.put("recipe", item.recipe());
            m.put("pantryMatch", item.pantryMatch());
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
