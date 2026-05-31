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

## Phase 3 — Household Invite Flow
- Currently `register` auto-assigns to the first household (fine for one household)
- Proper invite codes: one person creates household, shares code, others join
- Prevents accidental cross-household data mixing

## Phase 4 — Deploy to Internet
- **Digital Ocean App Platform** (~$12/mo app + ~$15/mo managed Postgres = ~$27/mo hard cap)
- **Render.com** is a close alternative — similar pricing, slightly cheaper
- Heroku works but pricier than it used to be
- Both support deploying a Spring Boot fat JAR or Docker container from GitHub
- Avoid AWS — no fixed price ceiling, easy to get surprise bills

## Backlog
- Database migrations — evaluate Flyway vs Liquibase (Liquibase advantage: already used at work, less context-switching). Increasingly urgent: `ddl-auto: update` is causing startup issues with schema changes on non-empty tables
- Forgot password / reset password flow (email via [Resend.com](https://resend.com))
- Switch frontend from Chakra UI v2 to v3 (API has changed — docs will match again)
- Move `ANTHROPIC_API_KEY` to a `.env` file for cleaner local dev
