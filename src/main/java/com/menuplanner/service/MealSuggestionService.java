package com.menuplanner.service;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.ContentBlock;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.Model;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class MealSuggestionService {

    @Value("${anthropic.api-key:}")
    private String apiKey;

    public Map<String, String> suggestMeals(
            String weekStart, String userPrompt, List<String> mealLibrary,
            Map<String, Map<String, Object>> weather,
            Map<String, String> existingMeals, String targetDate) {

        AnthropicClient client = AnthropicOkHttpClient.builder()
                .apiKey(apiKey)
                .build();

        boolean singleDay = targetDate != null && !targetDate.isBlank();

        String systemPrompt = singleDay ? """
                You are a helpful meal planning assistant. Given a list of meals the user has made before,
                the weather for a specific day, what's already planned that week, and the user's preference,
                suggest exactly one meal for that day.

                Respond with ONLY a JSON object with a single entry: {"YYYY-MM-DD": "Meal Name"}

                Choose only from the provided meal library. Avoid repeating meals already planned that week.
                """ : """
                You are a helpful meal planning assistant. Given a list of meals the user has made before,
                the weather forecast for the week, what's already planned, and the user's preferences,
                suggest one meal per day for any days not yet filled in.

                Respond with ONLY a JSON object mapping date strings (YYYY-MM-DD) to meal names.
                Only include days that need a suggestion — skip days that already have a meal.
                Example: {"2026-05-26": "Tacos", "2026-05-27": "Pasta"}

                Choose only from the provided meal library. Prefer meals that match the weather
                (light meals for hot days, hearty for cold) and respect any user constraints.
                Avoid repeating meals already planned that week.
                """;

        StringBuilder userMessage = new StringBuilder();
        userMessage.append("Week starting: ").append(weekStart).append("\n\n");

        userMessage.append("Meal library:\n");
        mealLibrary.forEach(m -> userMessage.append("- ").append(m).append("\n"));

        if (existingMeals != null && !existingMeals.isEmpty()) {
            userMessage.append("\nAlready planned this week:\n");
            existingMeals.forEach((date, meal) ->
                    userMessage.append(date).append(": ").append(meal).append("\n"));
        }

        userMessage.append("\nWeather forecast:\n");
        weather.forEach((date, w) -> {
            if (w != null) {
                userMessage.append(date).append(": ").append(w.get("condition"))
                        .append(", ").append(w.get("high")).append("°F high, ")
                        .append(w.get("low")).append("°F low\n");
            }
        });

        if (singleDay) {
            userMessage.append("\nSuggest a meal for: ").append(targetDate).append("\n");
        }
        userMessage.append("\nUser's request: ").append(userPrompt);

        Message response = client.messages().create(
                MessageCreateParams.builder()
                        .model(Model.CLAUDE_OPUS_4_7)
                        .maxTokens(256)
                        .system(systemPrompt)
                        .addUserMessage(userMessage.toString())
                        .build()
        );

        String content = response.content().stream()
                .filter(ContentBlock::isText)
                .map(b -> b.asText().text())
                .findFirst()
                .orElse("{}");

        return parseJsonToMap(content);
    }

    private Map<String, String> parseJsonToMap(String json) {
        Map<String, String> result = new LinkedHashMap<>();
        String cleaned = json.trim();
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replaceAll("^```[a-z]*\\n?", "").replaceAll("```$", "").trim();
        }
        cleaned = cleaned.replaceAll("^\\{", "").replaceAll("\\}$", "").trim();
        if (cleaned.isEmpty()) return result;
        for (String pair : cleaned.split(",(?=\\s*\"\\d{4}-\\d{2}-\\d{2}\")")) {
            String[] kv = pair.split(":\\s*", 2);
            if (kv.length == 2) {
                String key = kv[0].trim().replaceAll("^\"|\"$", "");
                String value = kv[1].trim().replaceAll("^\"|\"$", "");
                result.put(key, value);
            }
        }
        return result;
    }
}
