# Menu Planner Roadmap

## Phase 1 — PostgreSQL (local) ✅ done
- Swap H2 for Postgres
- Run locally via Docker (`docker compose up`)
- Keep `ddl-auto: update` for now (switch to migrations later)
- Excel seed still works as-is

## Phase 2 — Auth + Households ✅ done
- Spring Security + JWT (stateless, Bearer token stored in localStorage)
- `AppUser` entity: name, email, BCrypt password, belongs to a `Household`
- Endpoints: `POST /api/auth/login`, `/register`, `GET /api/auth/me`
- Frontend: login/register screen gates the planner; logout in header
- `Household` entity — all menu entries and history scoped to household
- Struthers household seeded; all existing data assigned on startup
- Meals scoped to households with opt-in sharing (`shared` flag)
- Duplicate meal names allowed across households; inline warning + choice in detail modal
- Household name shown as subtitle in app header

## Phase 2.5 — Meal Planning UX ✅ done
- **Candidate tray** — collapsible panel above the week; add meals then drag chips onto days
- **Drag-and-drop within the week** — grab a day's name label to move or swap meals between days; drag back to tray to unplan
- **Temperature constraints** — optional min/max °F on each meal; red warning when day's forecast violates the range
- **Season restrictions** — optional Spring/Summer/Fall/Winter checkboxes per meal; warns when planned out of season
- **Meal picker** dims incompatible meals (temp or season) for the day being planned
- **Print week** — opens a clean printable HTML summary with meals and weather
- **Clear this week** — bulk delete with confirmation dialog
- **AI week suggestions** work without typing (default prompt uses weather + history)
- **Add meal to library** without selecting a day (+ Add to meal library button)
- **Recipe link preserved** — inline saves no longer overwrite library metadata
- **Meal Library tab** — searchable list of all meals; edit name/link/notes/temp/seasons via modal; delete with inline confirmation (blocked if meal is still on the calendar); meal name is a clickable link when a recipe URL is set; season and temp constraint badges shown per meal

## Phase 2.6 — Bug Fixes & Observability ✅ done
- **Meal Library delete fixed** — Spring Security was converting all `ResponseStatusException` responses (409, 404, etc.) to 403 by blocking Tomcat's internal `/error` forward; fixed by adding `/error` to `permitAll()`
- **Error messages reach the frontend** — `server.error.include-message: always` added so toast messages show the actual reason (e.g. "meal is in use")
- **Response logging filter** — `ResponseLoggingFilter` logs every API response method, path, status, and body at INFO level for easier debugging
- **SLF4J logging in MealController** — debug-level logging on meal delete for household ownership diagnostics

## Phase 2.7 — History & Library Polish ✅ done
- **History deduplication** — switching meals on a day no longer accumulates entries; `saveMenu` upserts, `updateMenu` cleans up stragglers, and a one-time seeder SQL removed existing duplicates
- **Paginated history** — `GET /api/history?page=&size=` returns `{entries, page, totalPages, totalElements}`; History tab shows Prev/Next controls and page count
- **Jump-to-date in history** — date picker + Jump button navigates directly to the page containing that date (`GET /api/history/page-for-date`)
- **Paginated Meal Library** — client-side pagination (15 per page); search resets to page 1

## Phase 3 — Household Invite Flow
- Currently `register` auto-assigns to the first household (fine for one household)
- Proper invite codes: one person creates household, shares code, others join
- Prevents accidental cross-household data mixing

## Phase 4 — Deploy to Internet (in progress)
Platform: **DigitalOcean App Platform** (~$12/mo app + ~$15/mo managed Postgres = ~$27/mo hard cap)
One service: Spring Boot JAR serves the React build from `static/`. No CORS needed.

### Done
- ✅ Liquibase set up — `liquibase-core` added, `001-initial-schema.sql` captures full schema, `ddl-auto: none`, local DB synced

### Remaining
- Export local data → `002-seed-data.sql` (meals + menu entries + household; no users, no weather)
- Remove `MenuEntryExcelLoader` (Excel seed replaced by DB migration) and `HouseholdSeeder` ALTER TABLE DDL
- Wire React build into Maven (`frontend-maven-plugin` → `src/main/resources/static/`, SPA fallback)
- `application-prod.yaml`: env vars for DB, logging at WARN, `show-sql: false`, registration disabled via env flag
- DigitalOcean App Platform setup (GitHub → build → managed Postgres → env vars)
- First-deploy: create Rachel's user account via direct SQL (password hash stays out of public repo)

## Phase 3 — Household Invite Flow (after Phase 4)
- Invite codes: one person creates household, shares code, others join
- Currently `register` auto-assigns to the first household — fine until Joe needs to join
- Registration is disabled in prod until invite flow is built

## Backlog
- **Per-household weather location** — location currently hardcoded to Golden Valley MN; households should be able to set their own lat/lon (stored on `Household` entity); NWS for US locations, Open-Meteo fallback for international
- **Shared meal UI gap** — hide Edit/Delete buttons for shared meals belonging to another household (backend already enforces this with 403; UI shows buttons that silently fail)
- Forgot password / reset password flow (email via [Resend.com](https://resend.com))
- Switch frontend from Chakra UI v2 to v3 (API has changed — docs will match again)
- Move `ANTHROPIC_API_KEY` to a `.env` file for cleaner local dev
