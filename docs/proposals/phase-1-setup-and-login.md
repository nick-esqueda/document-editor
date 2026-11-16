# Phase 1: Project setup + login

**Goal:** `docker compose up`, open the browser, log in as a seeded user, see an empty app shell. Everything later builds on this.

## Scope

monorepo, Docker Compose, database migrations, seeded users, login/logout, session cookie, auth middleware, app shell, test setup.

## Out of scope

Sign-up, password reset, roles, OAuth. This is deliberately not a full auth system.

## Repo layout

```text
document-editor/
├─ client/          React + TS (Vite), React Router
├─ server/          Express + TS
│  ├─ src/routes/   auth.ts (later: documents.ts, access.ts, import.ts)
│  ├─ src/db/       pg pool, queries
│  └─ migrations/   node-pg-migrate SQL files
├─ shared/          types + Tiptap extension list (used by client AND server)
├─ docker-compose.yml   postgres, server, client
└─ docs/
```

npm workspaces tie the three packages together. `shared/` matters from Phase 2 on: the server validates document JSON with the same editor schema the client uses.

## Database

```sql
users (
  id            uuid primary key default gen_random_uuid(),
  username      text unique not null,      -- lowercase
  display_name  text not null,
  password_hash text not null,             -- bcrypt, cost 12
  created_at    timestamptz not null default now()
)
session (...)   -- managed by connect-pg-simple
```

**Seed:** `alice`, `bob`, `carol`. The dev password comes from `SEED_PASSWORD` in `.env` (example value in `.env.example`). The seed script is idempotent and runs after migrations.

## API

| Method | Route | Notes |
|---|---|---|
| POST | `/api/auth/login` | `{username, password}` → sets cookie, returns `{id, username, displayName}` |
| POST | `/api/auth/logout` | destroys session |
| GET  | `/api/auth/me` | current user, or 401 |

**Security rules (apply to every later phase):**
- Identity comes **only** from `req.session.userId`. Request bodies never carry a user id the server trusts.
- Cookie: `httpOnly`, `sameSite=lax`, `secure` in production. Session id regenerated on login.
- Same generic error for unknown user and wrong password. Login is rate-limited (10 attempts/min per IP).
- API only accepts `application/json` bodies (plus multipart for upload in Phase 4), which together with `sameSite` covers CSRF for this app.

## Frontend

Routes: `/login`, `/` (protected). A `<RequireAuth>` wrapper calls `/api/auth/me` and redirects to `/login` on 401. During dev, Vite proxies `/api` to the server so it's same-origin, matching production (see Phase 5).

## Wireframes

**Login**
```text
┌──────────────────────────────────────────────┐
│                                              │
│              📄  DocEditor                   │
│                                              │
│         ┌──────────────────────────┐         │
│         │ Username                 │         │
│         │ [ alice                ] │         │
│         │ Password                 │         │
│         │ [ ••••••••             ] │         │
│         │                          │         │
│         │ ⚠ Invalid username or    │ ← shown │
│         │   password               │   on    │
│         │                          │   error │
│         │      [   Log in   ]      │         │
│         └──────────────────────────┘         │
│      Demo users: alice, bob, carol           │ ← dev only
└──────────────────────────────────────────────┘
```

**App shell after login** (the document list fills this in Phase 2)
```text
┌──────────────────────────────────────────────┐
│ 📄 DocEditor                 Alice ▾ [Log out]│
├──────────────────────────────────────────────┤
│                                              │
│          You're logged in. Documents         │
│          arrive in Phase 2.                  │
│                                              │
└──────────────────────────────────────────────┘
```

## Testing

Vitest + supertest against a real Postgres (test database in the same compose file). Phase 1 tests: login success, wrong password, `/me` with and without cookie, logout invalidates the session.

## Acceptance criteria

Checks I run myself before asking you to review the PR:

- [ ] `cp .env.example .env && docker compose up -d` → `docker compose ps` shows postgres, server, client healthy
- [ ] `npm run migrate && npm run seed` run twice in a row with no errors (idempotent); `psql -c "select username from users"` → alice, bob, carol
- [ ] `curl -i -c jar -X POST localhost:3000/api/auth/login -H 'content-type: application/json' -d '{"username":"alice","password":"$SEED_PASSWORD"}'` → 200, `Set-Cookie` has `HttpOnly; SameSite=Lax`
- [ ] Same call with a wrong password and with an unknown user → identical 401 body
- [ ] `curl -b jar localhost:3000/api/auth/me` → 200 alice; without the cookie → 401; after `POST /api/auth/logout` with the cookie → 401
- [ ] 11 bad logins in a minute → the 11th returns 429
- [ ] `psql -c "select password_hash from users"` → bcrypt hashes (`$2b$12$…`), no plaintext
- [ ] `npm test` (Vitest + supertest auth suite) and `npm run lint` pass; CI is green on the PR
- [ ] Playwright smoke test: logged-out visit to `/` redirects to `/login`; login lands on the app shell; refresh stays logged in
