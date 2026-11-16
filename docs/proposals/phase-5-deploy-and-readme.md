# Phase 5: Deploy to AWS + README

**Goal:** the app runs on AWS at a public HTTPS URL, and the README lets anyone run it locally or redeploy it.

## Scope

S3 + CloudFront for the frontend, one EC2 instance running the API and Postgres in Docker, HTTPS, secrets handling, nightly database backup, deploy script, README.

## Out of scope

Autoscaling, RDS, multi-region, blue/green deploys. Easy to add later; not worth it at this size.

## Architecture

```text
                         ┌───────────────────────────── AWS ─────────────────────────────┐
                         │                                                               │
 Browser ──HTTPS──▶  CloudFront (one domain)                                            │
                         │   ├─ /*      ─▶ S3 bucket (private, OAC)   React build        │
                         │   └─ /api/*  ─▶ EC2 t4g.small ──────────────────────────┐    │
                         │                 │ Caddy :443 (TLS, Let's Encrypt)       │    │
                         │                 │   └▶ api container (Express :3000)    │    │
                         │                 │        └▶ postgres container (EBS vol)│    │
                         │                 └───────────────────────────────────────┘    │
                         │                         nightly pg_dump ─▶ S3 backups bucket │
                         └───────────────────────────────────────────────────────────────┘
```

**Why one CloudFront domain for both:** the session cookie is first-party, there's no CORS to configure, and it matches local dev (Vite proxies `/api`).

## Details

**CloudFront**
- `/api/*` behavior: caching disabled, all HTTP methods, forwards cookies, query strings and the `Content-Type` header.
- SPA routing: a small CloudFront Function rewrites non-`/api`, non-file paths (like `/d/123`) to `/index.html`. We avoid "custom error page → index.html" because it would also turn real API 404s into HTML.
- Hashed asset files cached for a year; `index.html` not cached.

**EC2**
- t4g.small (2 vCPU, 2 GB, ARM), Amazon Linux 2023, 20 GB gp3 disk. Docker + Compose.
- `docker-compose.prod.yml`: `caddy`, `api`, `postgres`. Postgres has no public port.
- Security group: 443 and 80 (for certificate renewal) only. No SSH port: shell access through SSM Session Manager.
- Secrets (`SESSION_SECRET`, DB password) in SSM Parameter Store, pulled into the containers at start. Nothing secret in git.
- Migrations run automatically when the API container starts. The seed runs once, with production passwords taken from Parameter Store.
- Nightly `pg_dump` to an S3 bucket via cron, kept 14 days.

**Deploy**
- `scripts/deploy-frontend.sh`: build → `aws s3 sync` → CloudFront invalidation of `/index.html`.
- `scripts/deploy-backend.sh`: SSM command on the instance → `git pull` → `docker compose up -d --build`.
- GitHub Actions can run both on merge to `main` later. Manual scripts first.

**Cost:** about $15/month (EC2 ≈ $12, EBS ≈ $2, S3 + CloudFront ≈ $1 at this traffic).

## README outline

1. What it is (one paragraph + screenshot)
2. Features, and **supported upload types: `.txt`, `.md` (max 1 MB)**
3. Run locally: `cp .env.example .env && docker compose up`, demo logins
4. Architecture (diagram above) and key decisions (Tiptap JSON storage, access model, 404-for-no-access, version conflicts)
5. Running tests
6. Deploying to AWS (step-by-step, links to the scripts)
7. Known limitations: no real-time co-editing, single access level, seeded users only, `.docx` not yet supported

## Wireframes

No new screens in this phase. The architecture diagram above is the visual for review.

## Open questions

- **Domain:** do you have a domain (or want one in Route 53, about $12/yr)? Caddy needs a hostname for the EC2 TLS certificate. *Without one:* CloudFront's `*.cloudfront.net` URL for users, and EC2 serves HTTP only, with the security group locked to CloudFront's IP ranges. That works, but the CloudFront → EC2 hop isn't encrypted.
- **Infrastructure as code:** *Default: no.* Documented console steps + scripts. Terraform is about half a day extra if you want reproducible infra.
- **AWS account/region:** I'll write the steps for `us-east-1` unless you prefer another region. You run the AWS steps, or give me credentials through the environment's secrets.

## Acceptance criteria

Run against the production URL:

- [ ] `curl -sI https://<domain>/` → 200, `text/html`; `curl -sI https://<domain>/d/anything` → 200 `index.html` (deep link works)
- [ ] `curl -s https://<domain>/api/does-not-exist` → JSON 404, not HTML
- [ ] `curl -i -X POST https://<domain>/api/auth/login …` → `Set-Cookie` with `Secure; HttpOnly; SameSite=Lax`
- [ ] The Phase 1-4 Playwright suite passes with `BASE_URL=https://<domain>`
- [ ] `nc -zv <ec2-ip> 5432` and `nc -zv <ec2-ip> 22` → refused/timeout; only 80/443 open
- [ ] `aws ssm send-command … "sudo reboot"`, wait, then the Playwright smoke test passes again and earlier docs are still there
- [ ] `aws s3 ls s3://<backup-bucket>/` shows a dump from the last 24 h; restoring it into a scratch Postgres container succeeds and row counts match
- [ ] `git grep -nE "SESSION_SECRET=|PASSWORD="` finds only `.env.example` placeholders
- [ ] Fresh clone in a clean container, following only the README → app running locally and alice can log in
