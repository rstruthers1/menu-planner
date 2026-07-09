# Rules-Based Meal Suggestions

Replace the AI suggestion feature with a deterministic, rules-based approach.

## Motivation

- AI suggestions are unreliable — hard to enforce constraints like "no repeats from last week"
- No Anthropic API cost per suggestion
- Fast — no network roundtrip
- Predictable — same rules, same behavior every time
- Easy to debug — user can see exactly why a meal was excluded

## Rules

| Rule | Default | Configurable |
|------|---------|--------------|
| No repeat within N days | On, 14 days | Yes — adjust N |
| Season match | On | Yes — toggle off |
| Weather match | On | Yes — toggle off |
| Skip already planned this week | Always on | No |

## How It Works

1. Start with the full meal library
2. Apply each enabled rule to filter out ineligible meals
3. Randomly pick from what remains
4. For the week view: fill each empty day independently
5. For the per-day view: pick one meal for that specific day

## UI

- Rules shown as toggles in a small expandable panel inside the "Need help planning?" box
- "No repeat within N days" has a number input for N
- "Suggest meals" button applies all enabled rules and fills empty days
- Per-day ✨ button applies the same rules for a single day (replaces AI chat modal)

## Backend

New endpoint: `POST /api/suggest-meals/rules`

Request:
```json
{
  "weekStart": "2026-07-06",
  "existingMeals": { "2026-07-06": "Tacos" },
  "weather": { "2026-07-06": { "high": 85, "low": 65, "condition": "Clear" } },
  "rules": {
    "noRepeatDays": 14,
    "seasonMatch": true,
    "weatherMatch": true
  },
  "targetDate": null
}
```

Response:
```json
{ "2026-07-07": "Grilled Salmon", "2026-07-08": "Stir Fry" }
```

The backend fetches the meal library and recent meal history, applies the rules, and returns random eligible picks. No AI call.

## Migration

- Remove `MealSuggestionService` AI chat logic
- Remove `AiChatModal` component
- Keep the `WeekHelper` UI but replace the textarea prompt with rule toggles
- Per-day ✨ button opens a simple picker showing eligible meals, not a chat

## Deferred

- User-specific rule preferences persisted per household (for now, rules reset to defaults on page load)
- "Must include" rules (e.g. always suggest a fish meal on Fridays)
