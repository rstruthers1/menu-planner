# Menu Planner Roadmap

## Phase 1 — PostgreSQL (local) ✅ done
- Swap H2 for Postgres
- Run locally via Docker (`docker compose up`)
- Keep `ddl-auto: update` for now (switch to migrations later)
- Excel seed still works as-is

## Phase 2 — Auth
- Spring Security + JWT (stateless, works well with React SPA)
- `User` entity: email, BCrypt password, display name
- Endpoints: `POST /api/auth/signup`, `/login`, `/forgot-password`, `/reset-password`
- Email via [Resend.com](https://resend.com) — generous free tier, simple API
- Frontend: login/signup screen before planner loads

## Phase 3 — Households
- `Household` entity; each `User` belongs to one household
- `MenuEntry` and history belong to the household, not the individual user
- All household members share the same planner and history
- Invite flow: send invite link by email → new user joins existing household
- Different households cannot see each other's data

## Phase 4 — Deploy to Internet
- **Digital Ocean App Platform** (~$12/mo app + ~$15/mo managed Postgres = ~$27/mo hard cap)
- **Render.com** is a close alternative — similar pricing, slightly cheaper
- Heroku works but pricier than it used to be
- Both support deploying a Spring Boot fat JAR or Docker container from GitHub
- Avoid AWS — no fixed price ceiling, easy to get surprise bills
