package com.menuplanner.controller;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.ContentBlock;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.Model;
import com.menuplanner.security.AppUserDetails;
import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.MalformedURLException;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/recipes")
public class RecipeImportController {

    private static final Logger log = LoggerFactory.getLogger(RecipeImportController.class);

    @Value("${anthropic.api-key:}")
    private String anthropicApiKey;

    @Value("${jina.api-key:}")
    private String jinaApiKey;

    @GetMapping("/import")
    public Map<String, Object> importRecipe(@RequestParam String url,
                                            @AuthenticationPrincipal AppUserDetails userDetails) {
        validateUrl(url);

        String body;
        Connection.Response response;
        try {
            response = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
                    .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
                    .header("Accept-Language", "en-US,en;q=0.9")
                    .header("Connection", "keep-alive")
                    .header("Upgrade-Insecure-Requests", "1")
                    .header("Sec-Fetch-Dest", "document")
                    .header("Sec-Fetch-Mode", "navigate")
                    .header("Sec-Fetch-Site", "none")
                    .header("Sec-Fetch-User", "?1")
                    .header("Sec-Ch-Ua", "\"Chromium\";v=\"125\", \"Google Chrome\";v=\"125\"")
                    .header("Sec-Ch-Ua-Mobile", "?0")
                    .header("Sec-Ch-Ua-Platform", "\"Windows\"")
                    .timeout(10_000)
                    .followRedirects(true)
                    .ignoreHttpErrors(true)
                    .execute();
            body = response.body();
        } catch (MalformedURLException e) {
            throw new RecipeImportException("INVALID_URL",
                    "That doesn't look like a valid URL.",
                    "Check for typos and make sure it starts with https://.");
        } catch (SocketTimeoutException e) {
            throw new RecipeImportException("TIMEOUT",
                    "The site took too long to respond.",
                    "Check that the URL still loads in your browser and try again.");
        } catch (IOException e) {
            throw new RecipeImportException("NETWORK_ERROR",
                    "Couldn't reach that URL.",
                    "Check that the link is still valid and that the server has internet access.");
        }

        int status = response.statusCode();
        String contentType = response.contentType() != null ? response.contentType() : "";

        if (!contentType.startsWith("text/html")) {
            String typeLabel = contentType.isBlank() ? "unknown type" : contentType.split(";")[0].trim();
            throw new RecipeImportException("NOT_HTML",
                    "That link points to a file, not a web page (content type: " + typeLabel + ").",
                    "Download it and copy the recipe details into the form manually.");
        }

        if (isCloudflareChallenge(body)) {
            Map<String, Object> jinaResult = tryViaJinaAndClaude(url);
            if (jinaResult != null) return jinaResult;
            throw new RecipeImportException("BOT_BLOCKED",
                    "This site is blocking automated access.",
                    "Open the recipe in your browser, copy the ingredients using \"Paste a list\", and paste the instructions into the Instructions field.");
        }

        if (status == 401) {
            throw new RecipeImportException("LOGIN_REQUIRED",
                    "This site requires you to be logged in to view that recipe.",
                    "Open the recipe in your browser, then copy and paste the ingredients and instructions into the form.");
        }

        if (status == 403) {
            Map<String, Object> jinaResult = tryViaJinaAndClaude(url);
            if (jinaResult != null) return jinaResult;
            throw new RecipeImportException("BOT_BLOCKED",
                    "This site is blocking automated access.",
                    "Open the recipe in your browser, copy the ingredients using \"Paste a list\", and paste the instructions into the Instructions field.");
        }

        if (status == 404) {
            throw new RecipeImportException("NOT_FOUND",
                    "That page wasn't found (404).",
                    "Check the URL in your browser — the recipe may have moved or been deleted.");
        }

        if (status >= 500) {
            throw new RecipeImportException("NETWORK_ERROR",
                    "The site returned a server error (HTTP " + status + ").",
                    "Try again later.");
        }

        if (isLoginRedirect(response.url().toString())) {
            throw new RecipeImportException("LOGIN_REQUIRED",
                    "This site requires you to be logged in to view that recipe.",
                    "Open the recipe in your browser, then copy and paste the ingredients and instructions into the form.");
        }

        Document doc;
        try {
            doc = response.parse();
        } catch (IOException e) {
            throw new RecipeImportException("NETWORK_ERROR",
                    "Couldn't parse the page.",
                    "Try again, or fill in the recipe fields manually.");
        }

        // Try JSON-LD first, then fall back to Claude if the API key is configured
        Map<String, Object> result = parseRecipeFromJsonLd(doc, url);
        if (result == null) {
            result = tryClaudeExtraction(doc, url);
        } else if (!result.containsKey("ingredients")) {
            // JSON-LD found name but no ingredients — try Claude to fill in the rest
            Map<String, Object> claudeResult = tryClaudeExtraction(doc, url);
            if (claudeResult != null && claudeResult.containsKey("ingredients")) {
                result.put("ingredients", claudeResult.get("ingredients"));
                result.remove("warning");
                result.remove("warningMessage");
                result.remove("warningSuggestion");
                if (!result.containsKey("instructions") && claudeResult.containsKey("instructions")) {
                    result.put("instructions", claudeResult.get("instructions"));
                }
                if (!result.containsKey("extendedData") && claudeResult.containsKey("extendedData")) {
                    result.put("extendedData", claudeResult.get("extendedData"));
                }
            }
        }
        if (result == null) {
            throw new RecipeImportException("NO_RECIPE_DATA",
                    "The page loaded but doesn't contain structured recipe data.",
                    "Use \"Paste a list\" for ingredients and paste the instructions in manually.");
        }
        return result;
    }

    private void validateUrl(String url) {
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme();
            if (scheme == null || (!scheme.equals("http") && !scheme.equals("https"))) {
                throw new RecipeImportException("INVALID_URL",
                        "That doesn't look like a valid URL.",
                        "Check for typos and make sure it starts with https://.");
            }
        } catch (IllegalArgumentException e) {
            throw new RecipeImportException("INVALID_URL",
                    "That doesn't look like a valid URL.",
                    "Check for typos and make sure it starts with https://.");
        }
    }

    private boolean isCloudflareChallenge(String body) {
        if (body == null) return false;
        return body.contains("Just a moment") ||
                body.contains("cf-browser-verification") ||
                body.contains("Enable JavaScript and cookies to continue") ||
                body.contains("Checking your browser before accessing");
    }

    private boolean isLoginRedirect(String url) {
        String lower = url.toLowerCase();
        return lower.contains("/login") || lower.contains("/signin") || lower.contains("/sign-in");
    }

    // Returns null if no schema.org/Recipe JSON-LD is found
    private Map<String, Object> parseRecipeFromJsonLd(Document doc, String sourceUrl) {
        // Use [type*=ld+json] (contains) to catch variants like "application/ld+json; charset=utf-8"
        Elements scriptTags = doc.select("script[type*=ld+json]");

        JSONObject recipeJson = null;
        for (Element script : scriptTags) {
            // Prefer .data() (raw content); fall back to .html() if empty
            String json = script.data().trim();
            if (json.isEmpty()) json = script.html().trim();
            if (json.isEmpty()) continue;
            try {
                recipeJson = findRecipeInJson(json);
                if (recipeJson != null) break;
            } catch (JSONException ignored) {}
        }

        if (recipeJson == null) return null;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sourceUrl", sourceUrl);

        String name = recipeJson.optString("name", "").trim();
        if (!name.isEmpty()) result.put("name", name);

        Object yield = recipeJson.opt("recipeYield");
        if (yield != null) {
            Integer servings = parseServings(yield);
            if (servings != null) result.put("servings", servings);
        }

        List<String> ingList = new ArrayList<>();
        JSONArray ingredients = recipeJson.optJSONArray("recipeIngredient");
        if (ingredients != null && !ingredients.isEmpty()) {
            for (int i = 0; i < ingredients.length(); i++) {
                String ing = ingredients.optString(i, "").trim();
                if (!ing.isEmpty()) ingList.add(ing);
            }
            if (!ingList.isEmpty()) result.put("ingredients", ingList);
        }

        Object instructions = recipeJson.opt("recipeInstructions");
        if (instructions != null) {
            String text = parseInstructions(instructions);
            if (!text.isEmpty()) result.put("instructions", text);
        }

        // Build extendedData blob from whatever metadata the JSON-LD contains
        JSONObject extended = new JSONObject();
        copyStringIfPresent(recipeJson, "prepTime", extended);
        copyStringIfPresent(recipeJson, "cookTime", extended);
        copyStringIfPresent(recipeJson, "totalTime", extended);
        copyStringIfPresent(recipeJson, "description", extended);
        copyStringIfPresent(recipeJson, "recipeCategory", extended, "category");
        copyStringIfPresent(recipeJson, "recipeCuisine", extended, "cuisine");
        Object kw = recipeJson.opt("keywords");
        if (kw instanceof String s && !s.isBlank()) {
            extended.put("keywords", s.trim());
        } else if (kw instanceof JSONArray arr && !arr.isEmpty()) {
            extended.put("keywords", arr.join(",").replace("\"",""));
        }
        // Try to detect ingredient groups: first via header markers, then Claude
        if (!ingList.isEmpty()) {
            JSONArray groups = detectIngredientGroups(ingList);
            if (groups == null) groups = tryDetectGroupsWithClaude(ingList);
            if (groups != null) extended.put("ingredientGroups", groups);
        }
        if (!extended.isEmpty()) result.put("extendedData", extended.toString());

        boolean hasIngredients = result.containsKey("ingredients");
        boolean hasName = result.containsKey("name");

        if (!hasIngredients && !hasName) return null;

        if (!hasIngredients) {
            result.put("warning", "PARTIAL_DATA");
            result.put("warningMessage", "Found the recipe name but no ingredients — the site's markup may be incomplete.");
            result.put("warningSuggestion", "The name has been filled in. Add ingredients using \"Paste a list\" or type them one by one.");
        }

        return result;
    }

    // Fetches the URL via Jina Reader (real browser) then extracts with Claude
    private Map<String, Object> tryViaJinaAndClaude(String originalUrl) {
        if (anthropicApiKey == null || anthropicApiKey.isBlank()) return null;
        log.info("Recipe import: trying Jina Reader for {}", originalUrl);
        try {
            HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
            HttpRequest.Builder jinaRequest = HttpRequest.newBuilder()
                    .uri(URI.create("https://r.jina.ai/" + originalUrl))
                    .header("Accept", "text/plain")
                    .header("X-Return-Format", "text")
                    .timeout(Duration.ofSeconds(30));
            if (jinaApiKey != null && !jinaApiKey.isBlank()) {
                jinaRequest.header("Authorization", "Bearer " + jinaApiKey);
            }
            HttpRequest request = jinaRequest.GET().build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            log.info("Recipe import: Jina returned status={}, text length={}", response.statusCode(), response.body().length());
            if (response.statusCode() != 200) return null;
            String text = response.body();
            if (text.length() > 12000) text = text.substring(0, 12000);
            return extractWithClaude(text, originalUrl);
        } catch (Exception e) {
            log.warn("Recipe import: Jina fetch failed: {}", e.getMessage());
            return null;
        }
    }

    // Falls back to Claude when the page loaded but has no JSON-LD
    private Map<String, Object> tryClaudeExtraction(Document doc, String sourceUrl) {
        if (anthropicApiKey == null || anthropicApiKey.isBlank()) {
            log.info("Recipe import: Anthropic API key not set, skipping Claude extraction");
            return null;
        }
        Element main = doc.selectFirst("main");
        Element article = doc.selectFirst("article");
        String pageText = main != null ? main.text()
                : article != null ? article.text()
                : doc.body() != null ? doc.body().text() : "";
        if (pageText.length() > 8000) pageText = pageText.substring(0, 8000);
        return extractWithClaude(pageText, sourceUrl);
    }

    private Map<String, Object> extractWithClaude(String pageText, String sourceUrl) {
        log.info("Recipe import: sending {} chars to Claude for {}", pageText.length(), sourceUrl);
        String prompt = """
                Extract the recipe from the following webpage text.
                Return ONLY valid JSON with no markdown, no explanation — just the JSON object:
                {
                  "name": "Recipe name",
                  "servings": 4,
                  "ingredients": ["1 cup flour", "2 eggs"],
                  "ingredientGroups": [
                    { "name": "Dressing", "ingredients": ["1 tbsp olive oil"] },
                    { "name": "Salad", "ingredients": ["4 cups romaine"] }
                  ],
                  "instructions": "Step 1...\\n\\nStep 2...",
                  "prepTime": "15 minutes",
                  "cookTime": "30 minutes",
                  "description": "Brief description of the dish"
                }
                Rules:
                - Omit any field you cannot find.
                - Include ingredientGroups only if the recipe has distinct named sections (e.g. "For the sauce:", "Dressing:"). If all ingredients are one flat list, omit ingredientGroups.
                - The "ingredients" field should always be the complete flat list regardless.
                - If there is no recipe on this page, return {}.

                Page text:
                """ + pageText;
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
                    .orElse("{}");
            raw = raw.trim();
            if (raw.startsWith("```")) {
                raw = raw.replaceAll("^```[a-z]*\\n?", "").replaceAll("```$", "").trim();
            }
            return mapClaudeResponse(new JSONObject(raw), sourceUrl);
        } catch (Exception e) {
            log.warn("Recipe import: Claude extraction failed: {}", e.getMessage(), e);
            return null;
        }
    }

    private Map<String, Object> mapClaudeResponse(JSONObject json, String sourceUrl) {
        if (json.isEmpty()) return null;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sourceUrl", sourceUrl);

        String name = json.optString("name", "").trim();
        if (!name.isEmpty()) result.put("name", name);

        int servings = json.optInt("servings", 0);
        if (servings > 0) result.put("servings", servings);

        JSONArray ingredients = json.optJSONArray("ingredients");
        if (ingredients != null) {
            List<String> ings = new ArrayList<>();
            for (int i = 0; i < ingredients.length(); i++) {
                String ing = ingredients.optString(i, "").trim();
                if (!ing.isEmpty()) ings.add(ing);
            }
            if (!ings.isEmpty()) result.put("ingredients", ings);
        }

        String instructions = json.optString("instructions", "").trim();
        if (!instructions.isEmpty()) result.put("instructions", instructions);

        // Build extendedData from Claude's structured response
        JSONObject extended = new JSONObject();
        JSONArray groups = json.optJSONArray("ingredientGroups");
        if (groups != null && !groups.isEmpty()) extended.put("ingredientGroups", groups);
        copyStringIfPresent(json, "prepTime", extended);
        copyStringIfPresent(json, "cookTime", extended);
        copyStringIfPresent(json, "description", extended);
        if (!extended.isEmpty()) result.put("extendedData", extended.toString());

        boolean hasName = result.containsKey("name");
        boolean hasIngredients = result.containsKey("ingredients");

        if (!hasName && !hasIngredients) return null;

        if (!hasIngredients) {
            result.put("warning", "PARTIAL_DATA");
            result.put("warningMessage", "Found the recipe name but no ingredients.");
            result.put("warningSuggestion", "Add ingredients using \"Paste a list\" or type them one by one.");
        }

        return result;
    }

    private JSONArray detectIngredientGroups(List<String> ingredients) {
        boolean hasHeaders = ingredients.stream().anyMatch(ing -> ing.trim().endsWith(":"));
        if (!hasHeaders) return null;

        JSONArray groups = new JSONArray();
        String currentName = null;
        JSONArray currentItems = new JSONArray();

        for (String ing : ingredients) {
            String trimmed = ing.trim();
            if (trimmed.endsWith(":")) {
                if (currentItems.length() > 0) {
                    JSONObject group = new JSONObject();
                    group.put("name", currentName != null ? currentName : "Ingredients");
                    group.put("ingredients", currentItems);
                    groups.put(group);
                    currentItems = new JSONArray();
                }
                currentName = trimmed.substring(0, trimmed.length() - 1).trim();
            } else {
                currentItems.put(trimmed);
            }
        }
        if (currentItems.length() > 0) {
            JSONObject group = new JSONObject();
            group.put("name", currentName != null ? currentName : "Ingredients");
            group.put("ingredients", currentItems);
            groups.put(group);
        }
        return groups.length() > 1 ? groups : null;
    }

    private JSONArray tryDetectGroupsWithClaude(List<String> ingredients) {
        if (anthropicApiKey == null || anthropicApiKey.isBlank()) return null;
        String prompt = "Given this flat list of recipe ingredients, determine if they logically split into distinct named groups (e.g. 'Dressing', 'Salad', 'Marinade', 'Sauce'). "
                + "Return ONLY valid JSON — an array of groups, each with 'name' and 'ingredients'. Every ingredient from the input MUST appear in exactly one group. "
                + "Example: [{\"name\":\"Pasta Salad\",\"ingredients\":[\"12 oz rotini\",\"1 cup olives\"]},{\"name\":\"Dressing\",\"ingredients\":[\"1/3 cup olive oil\"]}]. "
                + "If all ingredients clearly belong to a single component, return []. No markdown, no explanation.\n\nIngredients:\n"
                + String.join("\n", ingredients);
        try {
            AnthropicClient client = AnthropicOkHttpClient.builder().apiKey(anthropicApiKey).build();
            Message response = client.messages().create(
                    MessageCreateParams.builder()
                            .model(Model.CLAUDE_HAIKU_4_5_20251001)
                            .maxTokens(2000)
                            .addUserMessage(prompt)
                            .build()
            );
            String raw = response.content().stream()
                    .filter(ContentBlock::isText)
                    .map(b -> b.asText().text())
                    .findFirst().orElse("[]").trim();
            if (raw.startsWith("```")) raw = raw.replaceAll("^```[a-z]*\\n?", "").replaceAll("```$", "").trim();
            JSONArray arr = new JSONArray(raw);
            return arr.length() > 1 ? arr : null;
        } catch (Exception e) {
            log.warn("Recipe import: group detection with Claude failed: {}", e.getMessage());
            return null;
        }
    }

    private void copyStringIfPresent(JSONObject src, String srcKey, JSONObject dest) {
        copyStringIfPresent(src, srcKey, dest, srcKey);
    }

    private void copyStringIfPresent(JSONObject src, String srcKey, JSONObject dest, String destKey) {
        String val = src.optString(srcKey, "").trim();
        if (!val.isEmpty()) dest.put(destKey, val);
    }

    private JSONObject findRecipeInJson(String json) {
        if (json.startsWith("[")) {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.optJSONObject(i);
                if (obj != null) {
                    JSONObject found = findRecipeInObject(obj);
                    if (found != null) return found;
                }
            }
        } else {
            return findRecipeInObject(new JSONObject(json));
        }
        return null;
    }

    private JSONObject findRecipeInObject(JSONObject obj) {
        if (isRecipeType(obj.opt("@type"))) return obj;

        JSONArray graph = obj.optJSONArray("@graph");
        if (graph != null) {
            for (int i = 0; i < graph.length(); i++) {
                JSONObject item = graph.optJSONObject(i);
                if (item != null && isRecipeType(item.opt("@type"))) return item;
            }
        }
        return null;
    }

    private boolean isRecipeType(Object type) {
        if (type instanceof String s) return "Recipe".equals(s) || s.contains("schema.org/Recipe");
        if (type instanceof JSONArray arr) {
            for (int i = 0; i < arr.length(); i++) {
                String t = arr.optString(i, "");
                if ("Recipe".equals(t) || t.contains("schema.org/Recipe")) return true;
            }
        }
        return false;
    }

    private Integer parseServings(Object yield) {
        if (yield instanceof Integer i) return i;
        if (yield instanceof Number n) return n.intValue();
        String s = (yield instanceof JSONArray arr) ? arr.optString(0, "") : yield.toString();
        Matcher m = Pattern.compile("\\d+").matcher(s);
        return m.find() ? Integer.parseInt(m.group()) : null;
    }

    private String parseInstructions(Object raw) {
        if (raw instanceof String s) return s.trim();
        if (!(raw instanceof JSONArray arr)) return "";

        List<String> steps = new ArrayList<>();
        for (int i = 0; i < arr.length(); i++) {
            Object item = arr.get(i);
            if (item instanceof String s) {
                if (!s.isBlank()) steps.add(s.trim());
            } else if (item instanceof JSONObject obj) {
                String type = obj.optString("@type", "");
                if ("HowToSection".equals(type)) {
                    String sectionName = obj.optString("name", "").trim();
                    if (!sectionName.isEmpty()) steps.add(sectionName + ":");
                    JSONArray items = obj.optJSONArray("itemListElement");
                    if (items != null) {
                        for (int j = 0; j < items.length(); j++) {
                            JSONObject step = items.optJSONObject(j);
                            if (step != null) {
                                String text = step.optString("text", step.optString("name", "")).trim();
                                if (!text.isEmpty()) steps.add(text);
                            }
                        }
                    }
                } else {
                    String text = obj.optString("text", obj.optString("name", "")).trim();
                    if (!text.isEmpty()) steps.add(text);
                }
            }
        }
        return String.join("\n\n", steps);
    }

    @ExceptionHandler(RecipeImportException.class)
    @ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
    public Map<String, String> handleImportError(RecipeImportException e) {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("error", e.getErrorCode());
        body.put("message", e.getMessage());
        body.put("suggestion", e.getSuggestion());
        return body;
    }

    static class RecipeImportException extends RuntimeException {
        private final String errorCode;
        private final String suggestion;

        RecipeImportException(String errorCode, String message, String suggestion) {
            super(message);
            this.errorCode = errorCode;
            this.suggestion = suggestion;
        }

        String getErrorCode() { return errorCode; }
        String getSuggestion() { return suggestion; }
    }
}
