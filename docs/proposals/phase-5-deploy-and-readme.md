# Phase 5: Deploy to Render + README

**Goal:** the app runs at a public HTTPS URL, and the README lets anyone run it locally or redeploy it.

## Summary (1-2 min read)

**What you get:** the app live at https://ajaia.nickesqueda.com, redeployed automatically on every push to `main`, plus a README that explains what it is, how to run it locally in a few minutes, how it's built, and how to deploy it.

**How it's built:**

- One Render web service runs the existing Docker image. The Express server also serves the built React app, so pages and `/api/*` share one origin and the login cookie just works.
- A Render managed Postgres database holds the data. It isn't reachable from the internet, and Render handles its backups.
- `render.yaml` (a Render Blueprint) describes both, so setup is a few clicks in the Render dashboard.
- Render generates `SESSION_SECRET` and the demo password on first deploy. Neither is in git.
- HTTPS is automatic, including for the custom domain. You add one CNAME record.
- Cost is about $13 a month (web service $7, Postgres $6).

**Deliberately not included:** AWS, Terraform, autoscaling, multiple regions, staging environments.

**Decisions (confirmed by Nick):** Render instead of AWS, app at `ajaia.nickesqueda.com`, region Ohio (US East), DNS record added by Nick outside Render, Nick does the Render setup from [docs/deploy/render-setup.md](../deploy/render-setup.md).

---

## Scope

Production Docker image that serves both the API and the frontend, Render Blueprint, custom domain, secrets handling, setup steps, README.

## Out of scope

AWS (replaced by Render), infrastructure as code beyond `render.yaml`, autoscaling, multi-region, staging or preview environments, custom backup jobs (Render's managed backups are used), the Phase 4 upload code.

## Architecture

```text
 Browser ──HTTPS──▶ ajaia.nickesqueda.com (CNAME → Render, automatic certificate)
                         │
                         ▼
               Render web service (Docker, Ohio)
               Express :PORT
                 ├─ /api/*   → API routes
                 ├─ /assets/* → hashed JS/CSS (cached 1 year)
                 └─ other    → index.html (React Router takes over)
                         │  private network only
                         ▼
               Render Postgres 16 (managed backups)
```

**Why one service for both:** the session cookie is first-party, there's no CORS to configure, and it matches local dev (Vite proxies `/api`).

## Details

**Docker image** (`Dockerfile`)

- Stage 1 installs the client and shared workspaces and runs `vite build`.
- Stage 2 installs only the server's runtime dependencies and copies in `client/dist`. It sets `CLIENT_DIST_DIR`, which tells the server to serve the frontend.
- On start: migrations, then the seed (safe to re-run; keeps the demo password in sync with `SEED_PASSWORD`), then the server.

**Serving the frontend** (`server/src/http/serveClientApp.ts`)

- `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`.
- Paths without a file extension that aren't `/api` (like `/d/123`): `index.html` with `Cache-Control: no-cache`.
- A missing file (like `/assets/old.js`) is a real 404, and unknown `/api` paths keep their JSON 404.
- It is registered before the session middleware, so static files never touch the session store.
- Only on when `CLIENT_DIST_DIR` is set. Local dev and tests are unchanged.

**Render** (`render.yaml`)

- Web service `ajaia-doc-editor`: Docker runtime, Starter plan, Ohio, auto-deploy from `main`, health check on `/`, custom domain `ajaia.nickesqueda.com`.
- Database `ajaia-db`: Postgres 16, Basic 256 MB plan, Ohio, empty IP allow list (no outside connections). `DATABASE_URL` is the internal connection string.
- `SESSION_SECRET` and `SEED_PASSWORD` use `generateValue`. The demo password is read in the service's Environment tab.
- Behind Render's load balancer, Express trusts one proxy hop (unchanged), so cookies are `Secure` and the login rate limit uses the client IP.

**Deploys:** push to `main`. Render builds the image, waits for the health check, then switches traffic. A failed build or health check leaves the previous version running.

## README outline

1. What it is (one paragraph + screenshot)
2. Features, and **supported upload types: `.txt`, `.md` (max 1 MB)**
3. Run locally: `cp .env.example .env && docker compose up`, demo logins
4. Architecture (diagram above) and key decisions (Tiptap JSON storage, access model, 404-for-no-access, version conflicts)
5. Running tests
6. Deploying to Render (link to `docs/deploy/render-setup.md`)
7. Known limitations: no real-time co-editing, single access level, seeded users only, `.docx` not yet supported

## Wireframes

No new screens in this phase.

## Acceptance criteria

Before deploy (run locally against the production image):

- [x] `docker build` succeeds. The container starts with `PORT`, `DATABASE_URL`, `SESSION_SECRET` and `SEED_PASSWORD` set, migrates and seeds.
- [x] `/`, `/login` and `/d/anything` → 200 `text/html`, `Cache-Control: no-cache`. A hashed asset → 200 with a one-year immutable cache. `/assets/missing.js` → 404.
- [x] `/api/does-not-exist` → JSON 404.
- [x] Login with `X-Forwarded-Proto: https` → `Set-Cookie` with `HttpOnly; Secure; SameSite=Lax`.
- [x] Server unit tests cover the routes above (`server/test/serveClientApp.test.ts`). Lint, typecheck and format pass.

After Nick's setup (run against https://ajaia.nickesqueda.com):

- [ ] `curl -sI https://ajaia.nickesqueda.com/` and `/d/anything` → 200 `text/html` with a valid certificate.
- [ ] `curl -s https://ajaia.nickesqueda.com/api/does-not-exist` → JSON 404, not HTML.
- [ ] `curl -i -X POST https://ajaia.nickesqueda.com/api/auth/login …` → `Set-Cookie` with `Secure; HttpOnly; SameSite=Lax`.
- [ ] 11 wrong-password logins in a row → the 11th gets 429. A correct login from another network still works.
- [ ] The Phase 1-4 Playwright suite passes with `BASE_URL=https://ajaia.nickesqueda.com` and the production `SEED_PASSWORD`.
- [ ] A push to `main` triggers a deploy, and documents created before it are still there afterwards.
- [ ] `git grep -nE "SESSION_SECRET=|PASSWORD="` finds only `.env.example` placeholders.
- [ ] Fresh clone in a clean container, following only the README → app running locally and alice can log in.
