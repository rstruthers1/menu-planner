# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack meal planning app. The backend is a Spring Boot 3.5 REST API backed by an in-memory H2 database. The frontend is a React + Vite SPA using Chakra UI. They are developed independently but served together: Vite proxies `/api` requests to the Spring Boot server on port 8080.

## Commands

### Backend (Maven, run from repo root)
```
mvn spring-boot:run          # Start backend on port 8080
mvn package                  # Build fat JAR
mvn test                     # Run tests
```

### Frontend (run from `frontend/`)
```
npm install                  # Install dependencies (first time)
npm run dev                  # Start Vite dev server on port 5173 (proxies /api → localhost:8080)
npm run build                # Production build
npm run lint                 # ESLint
```

### H2 Console
Available at `http://localhost:8080/h2-console` when the backend is running. JDBC URL: `jdbc:h2:mem:menu_planner`.

## Architecture

### Backend (`src/main/java/com/menuplanner/`)
Standard Spring Boot layered architecture:
- `domain/MenuEntry.java` — JPA entity (Lombok `@Data`). Fields: `mealDate`, `dayOfWeek`, `mealName`, `weather`, `highTempF`, `lowTempF`, `recipeLink`, `notes`.
- `repository/MenuEntryRepository.java` — `JpaRepository<MenuEntry, Long>`, no custom queries yet.
- `service/MenuEntryService.java` — thin service wrapping the repository.
- `controller/MenuEntryController.java` — REST endpoints at `/api/menus` (`GET` list, `POST` create).
- `util/MenuEntryExcelLoader.java` — reads `src/main/resources/data/menu_seed.xlsx` using Apache POI and seeds the database on startup via a `CommandLineRunner` bean in `MenuPlannerApplication`.

The database is in-memory H2 with `ddl-auto: update`, so schema is managed by Hibernate and data is re-seeded from the Excel file on every restart.

### Frontend (`frontend/src/`)
- `App.jsx` — root component; fetches `/api/menus` on mount and holds the `menus` state array.
- `components/MenuForm.jsx` — controlled form for adding a new entry. Also calls `/api/weather?date=<date>` to auto-populate weather fields (endpoint not yet implemented in the backend).
- `components/MenuTable.jsx` — renders the entries as a Chakra UI striped table.

### Key dependency notes
- Chakra UI v2 (not v3) — component API differs from current docs; use `@chakra-ui/react@^2`.
- No React Router; single-page, no client-side routing.
- `GET /api/weather?date=YYYY-MM-DD` is handled by `WeatherController`. It calls Open-Meteo's archive API for past dates and the forecast API for today/future, then returns `{ condition, high, low }` in Fahrenheit. Location is hardcoded to Minneapolis (~44.99°N, -93.41°W).
