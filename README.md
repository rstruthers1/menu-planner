# Menu Planner

A full-stack household meal planning app. Plan your week, browse history, manage a meal library with recipes, and get rules-based suggestions filtered by season, weather, cooking method, and recent history.

## Tech Stack

**Backend** — Spring Boot 3.5, PostgreSQL, Liquibase, Spring Security (JWT)  
**Frontend** — React + Vite, Chakra UI v2  
**External API** — [Open-Meteo](https://api.open-meteo.com) for weather (Minneapolis/Golden Valley area)

## Running Locally

### Prerequisites

- Java 21+
- Node 18+
- Docker (for PostgreSQL)

### Backend

Start PostgreSQL via Docker Compose, then run Spring Boot:

```bash
docker compose up -d
mvn spring-boot:run
```

Backend starts at `http://localhost:8080`.  
H2 console (dev only): `http://localhost:8080/h2-console`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend starts at `http://localhost:5173`. Vite proxies `/api` to the backend.

## Features

- **Week planner** — plan meals day by day with weather context; drag and drop to swap days
- **Meal library** — add and tag meals with season suitability, temperature range, cooking method, and weekend-only flag
- **Rules-based suggestions** — fill empty days automatically, respecting no-repeat window, season, weather, excluded cooking methods (e.g. skip grilling during a heat wave), and weekend-only meals skipped on weeknights
- **Recipe management** — store ingredients and instructions; link recipes to meals and cookbooks
- **History** — browse past meal entries
- **Candidate tray** — hold meals you're considering by dragging them off the calendar
- **Print view** — clean printable week summary
- **Multi-household** — each household has its own meal library and planner; meals can optionally be shared globally
- **Weather** — auto-fetched per day from Open-Meteo (archive for past dates, forecast for upcoming)

## Database Backup

With Docker running:

```powershell
.\backup\backup.ps1
```

Saves a timestamped `.sql` dump to the `backup/` folder.

## Dev Commands

```bash
# Backend
mvn spring-boot:run       # start backend
mvn test                  # run tests
mvn package               # build fat JAR

# Frontend (from frontend/)
npm run dev               # start dev server
npm run build             # production build
npm run lint              # ESLint
```

## Authors

Rachel Struthers
