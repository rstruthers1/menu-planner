# TODO

## UI / UX

- [x] **Slot machine: rename to "Surprise me!" and remove suggestion cards below reels**
  Users pick directly from the three slot tiles; the duplicate cards below are redundant.

- [x] **Partial search text saved as new meal on blur**
  Typing in the day row meal input then clicking away saves the partial text as a new meal.
  Fix: only save on explicit confirm (Enter or selecting a suggestion), not on blur.

- [x] **Recipe link should show domain name**
  Display the hostname (e.g. "allrecipes.com") instead of a generic label, so users know the source at a glance.
  Use `new URL(recipeLink).hostname` stripped of "www." wherever recipe links appear.

- [x] **Candidate meals persist across page refreshes** — stored in `localStorage` (`candidateMeals` key)

- [ ] **New meal library entry available in planner without page refresh**
  After adding a meal via "Add to meal library", it doesn't appear in autocomplete until the page is refreshed, which wipes the candidate tray.
  Root cause: `MealLibrary` tab has its own `handleAdded` that only updates local state — `App`'s `mealLibrary` never gets the new entry.
  Fix: pass `setMealLibrary` (or an `onMealAdded` callback) from `App` down to `MealLibrary` so adds from that tab update shared state. No DB persistence needed.
