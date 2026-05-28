package com.menuplanner.service;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.ContentBlock;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.Model;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
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

    public Map<String, Object> chat(
            String targetDate, String dayName,
            Map<String, Object> weather,
            Map<String, String> existingMeals,
            List<String> mealLibrary,
            List<Map<String, String>> messages,
            List<Map<String, Object>> history) {

        AnthropicClient client = AnthropicOkHttpClient.builder().apiKey(apiKey).build();

        String systemPrompt = """
                You are a helpful meal planning assistant. Suggest meals based on the user's actual history.

                Always respond with ONLY valid JSON in this exact format:
                {
                  "message": "Brief 1-2 sentence intro or follow-up response",
                  "suggestions": [
                    {"name": "Exact Meal Name", "reason": "Specific reason referencing their history or weather"}
                  ]
                }

                Rules:
                - Choose meal names exactly as they appear in the provided meal library
                - Provide 3-5 suggestions unless the user asks for more or fewer
                - Write reasons that reference real patterns: "You've had this on Mondays before",
                  "You often have this when it's around 80°F", "A go-to for warm cloudy days", etc.
                - Day-of-week history is a soft consideration — suggest good meals from the full library,
                  not just meals tied to that day
                - If suggestions would repeat meals already planned this week, skip them
                - If the message is purely conversational with no meal request, set suggestions to []
                """;

        StringBuilder ctx = new StringBuilder();
        ctx.append("Planning a meal for ").append(dayName).append(", ").append(targetDate).append(".\n\n");

        if (weather != null) {
            ctx.append("Today's weather: ").append(weather.get("condition"))
               .append(", ").append(weather.get("high")).append("°F high / ")
               .append(weather.get("low")).append("°F low\n\n");
        }

        if (history != null && !history.isEmpty()) {
            // Day-of-week patterns (soft signal only — don't limit suggestions to these)
            Map<String, Long> dayFreq = new LinkedHashMap<>();
            history.stream()
                    .filter(e -> dayName.equalsIgnoreCase((String) e.get("dayOfWeek")))
                    .map(e -> (String) e.get("mealName"))
                    .filter(m -> m != null && !m.isEmpty())
                    .forEach(m -> dayFreq.merge(m, 1L, Long::sum));

            List<Map.Entry<String, Long>> topDay = dayFreq.entrySet().stream()
                    .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                    .limit(6)
                    .collect(java.util.stream.Collectors.toList());

            if (!topDay.isEmpty()) {
                ctx.append("Meals you've had on ").append(dayName).append("s before (for context only):\n");
                topDay.forEach(e -> ctx.append("- ").append(e.getKey())
                        .append(" (").append(e.getValue()).append("x)\n"));
                ctx.append("\n");
            }

            // Weather similarity: within 15°F of today's high
            if (weather != null && weather.get("high") != null) {
                int currentHigh = ((Number) weather.get("high")).intValue();
                List<String> weatherMeals = history.stream()
                        .filter(e -> e.get("highTempF") != null)
                        .filter(e -> Math.abs(((Number) e.get("highTempF")).intValue() - currentHigh) <= 15)
                        .map(e -> (String) e.get("mealName"))
                        .filter(m -> m != null && !m.isEmpty())
                        .distinct()
                        .limit(8)
                        .collect(java.util.stream.Collectors.toList());

                if (!weatherMeals.isEmpty()) {
                    ctx.append("Meals you've had in similar weather (~").append(currentHigh).append("°F):\n");
                    weatherMeals.forEach(m -> ctx.append("- ").append(m).append("\n"));
                    ctx.append("\n");
                }
            }
        }

        if (existingMeals != null && !existingMeals.isEmpty()) {
            ctx.append("Already planned this week (do not repeat):\n");
            existingMeals.forEach((d, m) -> ctx.append(d).append(": ").append(m).append("\n"));
            ctx.append("\n");
        }

        ctx.append("Full meal library:\n");
        mealLibrary.forEach(m -> ctx.append("- ").append(m).append("\n"));
        ctx.append("\n---\n");

        MessageCreateParams.Builder builder = MessageCreateParams.builder()
                .model(Model.CLAUDE_HAIKU_4_5_20251001)
                .maxTokens(1024)
                .system(systemPrompt);

        for (int i = 0; i < messages.size(); i++) {
            Map<String, String> msg = messages.get(i);
            String role = msg.get("role");
            String content = msg.get("content");
            if ("user".equals(role)) {
                builder.addUserMessage(i == 0 ? ctx + content : content);
            } else if ("assistant".equals(role)) {
                builder.addAssistantMessage(content);
            }
        }

        Message response = client.messages().create(builder.build());
        String raw = response.content().stream()
                .filter(ContentBlock::isText)
                .map(b -> b.asText().text())
                .findFirst()
                .orElse("{\"message\":\"I couldn't generate suggestions.\",\"suggestions\":[]}");

        Map<String, Object> result = parseChatResponse(raw);

        // Remove suggestions already planned this week
        if (existingMeals != null && !existingMeals.isEmpty()) {
            java.util.Set<String> planned = new java.util.HashSet<>(existingMeals.values());
            @SuppressWarnings("unchecked")
            List<Map<String, String>> suggestions = (List<Map<String, String>>) result.get("suggestions");
            if (suggestions != null) {
                suggestions.removeIf(s -> planned.contains(s.get("name")));
            }
        }

        return result;
    }

    private Map<String, Object> parseChatResponse(String raw) {
        try {
            String cleaned = raw.trim();
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replaceAll("^```[a-z]*\\n?", "").replaceAll("```$", "").trim();
            }
            JSONObject obj = new JSONObject(cleaned);
            List<Map<String, String>> suggestions = new ArrayList<>();
            JSONArray arr = obj.optJSONArray("suggestions");
            if (arr != null) {
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject s = arr.getJSONObject(i);
                    Map<String, String> item = new LinkedHashMap<>();
                    item.put("name", s.optString("name", ""));
                    item.put("reason", s.optString("reason", ""));
                    suggestions.add(item);
                }
            }
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("message", obj.optString("message", ""));
            result.put("suggestions", suggestions);
            return result;
        } catch (Exception e) {
            return Map.of("message", raw, "suggestions", List.of());
        }
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
