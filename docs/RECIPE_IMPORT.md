# Recipe Import from URL

Auto-populate a recipe form by pasting a URL (e.g. an AllRecipes link).

## How it works

Most major recipe sites embed structured data in their HTML as a
`<script type="application/ld+json">` block containing a
`schema.org/Recipe` object. Parsing that block is far more reliable
than screen-scraping HTML because it's machine-readable and
site-independent.

**Extraction strategy (in order):**

1. **JSON-LD** — look for `<script type="application/ld+json">` blocks
   that contain `"@type": "Recipe"`. This works on AllRecipes, Food
   Network, Serious Eats, NYT Cooking, and most modern recipe sites.
2. **OpenGraph fallback** — if no JSON-LD is found, pull `og:title` and
   `og:description` for name/notes only.
3. **Fail gracefully** — return a 422 with a clear message so the user
   can fill in fields manually.

AllRecipes (the target site) uses JSON-LD so step 1 will hit.

---

## Backend: new endpoint

`GET /api/recipes/import?url=<encoded-url>`

**Flow:**

1. Fetch the URL using Java's `HttpClient` (JDK 11+, already available)
   with a browser-like `User-Agent` header to avoid bot blocks.
2. Parse the HTML with **Jsoup** (new dependency, ~500 KB) to extract
   `<script type="application/ld+json">` nodes.
3. Find the node whose `@type` is `"Recipe"` (may be an array).
4. Map fields and return JSON to the frontend.

**New Maven dependency:**

```xml
<dependency>
    <groupId>org.jsoup</groupId>
    <artifactId>jsoup</artifactId>
    <version>1.18.1</version>
</dependency>
```

Jackson is already on the classpath (via spring-boot-starter-web) for
JSON-LD parsing, and `org.json` is also present as a fallback.

**Response shape** (matches what RecipeDialog already knows how to use):

```json
{
  "name": "Mom's Zucchini Pancakes",
  "servings": 8,
  "sourceUrl": "https://www.allrecipes.com/recipe/222870/...",
  "ingredients": [
    "2 cups shredded zucchini",
    "1 egg",
    "..."
  ],
  "instructions": "Step 1: ...\nStep 2: ..."
}
```

**Schema.org field mapping:**

| JSON-LD field            | Our field       | Notes                                          |
|--------------------------|-----------------|------------------------------------------------|
| `name`                   | name            |                                                |
| `recipeYield`            | servings        | parse first integer from "8 servings" or "8"  |
| `recipeIngredient[]`     | ingredients     | already a string array                         |
| `recipeInstructions[]`   | instructions    | may be strings or HowToStep `{text}` objects — concatenate with newlines |
| `url` or request URL     | sourceUrl       |                                                |
| `description`            | (ignored)       | could add later as notes                       |

**New file:**
`src/main/java/com/menuplanner/controller/RecipeImportController.java`

No new service layer needed — it's a single stateless fetch-and-parse.
Keep it in the controller for now; extract to a service if it grows.

---

## Frontend: "Import from URL" flow

Add to the top of `RecipeDialog` (before the Recipe Name field):

```
[ https://www.allrecipes.com/recipe/222870/...   ] [Import]
  ↑ small Input, full-width                         ↑ sm Button, shows spinner
```

**Behavior:**

- User pastes a URL and clicks Import (or hits Enter in the field).
- Button shows a loading spinner; other fields are disabled.
- On success, the form fields pre-fill. The user can edit before saving.
- On failure, a toast shows the error ("Could not read recipe from that
  URL. You can fill in the fields manually.").
- The import URL box is separate from the `sourceUrl` form field; after
  import, `sourceUrl` is set to the imported URL automatically.

**No new component needed** — changes live entirely in `RecipeDialog.jsx`.

---

## Error handling

The backend detects failure mode and returns a structured error body:

```json
{
  "error": "NO_RECIPE_DATA",
  "message": "The page loaded but doesn't contain structured recipe data.",
  "suggestion": "Try copying the ingredients and instructions manually and pasting them into the form."
}
```

The frontend shows `message` + `suggestion` in a persistent inline
alert (not a toast) so the user can read it while filling in the form.

### Failure taxonomy

| What happened | Detected by | `error` code | User message | Suggestion |
|---|---|---|---|---|
| URL is not a valid URL | `MalformedURLException` / regex | `INVALID_URL` | "That doesn't look like a valid URL." | "Check for typos and make sure it starts with https://." |
| Page not found | HTTP 404 | `NOT_FOUND` | "That page wasn't found (404)." | "Check the URL in your browser — the recipe may have moved or been deleted." |
| Login required / paywalled | HTTP 401 or 403 + no Cloudflare header | `LOGIN_REQUIRED` | "This site requires you to be logged in to view that recipe." | "Open the recipe in your browser, then copy and paste the ingredients and instructions into the form." |
| Cloudflare or bot block | HTTP 403 + `cf-ray` response header, or body contains "Just a moment" / "Enable JavaScript" | `BOT_BLOCKED` | "This site is blocking automated access." | "Open the recipe in your browser, then use the 'Paste a list' button to copy the ingredients in, and paste the instructions into the Instructions field." |
| Not an HTML page (PDF, image, etc.) | `Content-Type` doesn't start with `text/html` | `NOT_HTML` | "That link points to a file, not a web page (content type: {type})." | "Download it and copy the recipe details into the form manually." |
| Page loaded but no recipe markup | JSON-LD present but no `@type: Recipe`; no OpenGraph title either | `NO_RECIPE_DATA` | "The page loaded but doesn't contain structured recipe data — this site may not be supported." | "Use the 'Paste a list' button for ingredients and paste the instructions in manually." |
| Partial data only (name but no ingredients) | JSON-LD Recipe found but `recipeIngredient` is empty | `PARTIAL_DATA` | "Found the recipe name but no ingredients — the site's markup may be incomplete." | "The name has been filled in; add ingredients using 'Paste a list' or type them one by one." |
| Timeout | `HttpTimeoutException` (10 s limit) | `TIMEOUT` | "The site took too long to respond." | "Check that the URL still loads in your browser and try again." |
| DNS / network error | `IOException` not covered above | `NETWORK_ERROR` | "Couldn't reach that URL." | "Check that the link is still valid and that your server has internet access." |

### Backend signal details

**Cloudflare detection** — check for any of:
- Response header `cf-ray` present
- HTTP 403 and response body contains `"Just a moment"` or `"cf-browser-verification"`

**Login-required detection** — HTTP 401, or HTTP 403 without Cloudflare markers,
or a redirect to a URL containing `/login`, `/signin`, `/account`.

**Partial data** — `PARTIAL_DATA` is not a fatal error; the response still
returns HTTP 200 with whatever was found plus a `warning` field. The
frontend shows the inline alert at `warning` level (yellow) instead of
red, and pre-fills what it has.

---

## What won't work

- Sites that require login (NYT Cooking behind paywall, etc.)
- Sites that render recipe data client-side via JavaScript only (rare
  for recipe sites — most include JSON-LD in the initial HTML for SEO)
- Sites with Cloudflare bot protection
- PDFs, scanned cookbook images — out of scope

AllRecipes and other large food media sites (Dotdash Meredith network)
use deep bot detection (TLS fingerprinting, JS challenges) that blocks
server-side HTTP clients regardless of headers. Personal recipe blogs
and many independent cooking sites work well.

---

## Implementation steps

1. Add Jsoup to `pom.xml`
2. Add `RecipeImportController` with the fetch + parse logic; throw a
   custom `RecipeImportException(errorCode, message, suggestion)` for
   each failure case; map it to 422 via `@ExceptionHandler`
3. Permit `/api/recipes/import` in `SecurityConfig` (authenticated, same
   as other recipe endpoints — no special handling needed)
4. Add the import URL row to `RecipeDialog.jsx`; on error, show the
   `message` + `suggestion` in a persistent inline `Alert` (not a
   toast); on `PARTIAL_DATA` warning, show yellow alert and still
   pre-fill the form
5. Test with the AllRecipes zucchini pancake URL, a paywalled URL, a
   Cloudflare-protected site, and a plain non-recipe URL
