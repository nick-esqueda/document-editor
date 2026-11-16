# Plan summary (2-minute read)

**What we're building:** a small Google-Docs-style editor. Users log in, create and format documents, autosave, share them with other users, and import `.txt`/`.md` files. No real-time co-editing.

**Stack:** React + TypeScript (Vite) · Node/Express + TypeScript · PostgreSQL · Tiptap editor, content stored as Tiptap JSON in a `jsonb` column. One monorepo (`client/`, `server/`, `shared/`), `docker compose up` runs everything locally.

## Phases

Each phase gets its own proposal doc (linked) that you approve before I write code.

| # | Phase | You'll be able to… |
|---|-------|--------------------|
| 1 | [Setup + login](proposals/phase-1-setup-and-login.md) | run the app locally and log in as a seeded user (alice / bob / carol) |
| 2 | [Documents + editor](proposals/phase-2-documents-and-editor.md) | create, rename, list, edit (bold, italic, underline, H1-H3, lists), autosave, reopen your own docs |
| 3 | [Sharing](proposals/phase-3-sharing.md) | give another user access to a doc; list shows **My documents** vs **Shared with me** |
| 4 | [Upload](proposals/phase-4-upload.md) | import a `.txt` or `.md` file as a new editable doc |
| 5 | [Deploy + README](proposals/phase-5-deploy-and-readme.md) | use it on AWS (S3 + CloudFront, API + Postgres in Docker on one EC2) |
| ★ | Stretch | import `.docx` via mammoth.js |

## Decisions worth a second look

1. **One origin for frontend and API.** CloudFront serves the React app *and* forwards `/api/*` to EC2. Cookies stay first-party, so there's no CORS and no cross-site cookie issues.
2. **Edit conflicts are caught, not merged.** Without real-time editing, two people saving at once could overwrite each other. Each save sends a version number, and a stale save gets a "this doc changed, reload" banner instead of silently clobbering.
3. **No access means 404.** If you can't access a doc, the API says it doesn't exist, so doc IDs don't leak.
4. **Imports are converted on the server** and checked against the editor schema, so stored content is always valid and can't carry scripts.

## Open questions (I'll use the default unless you say otherwise)

| Question | Default |
|---|---|
| Can owners delete docs? | Yes, owner-only delete (small add in Phase 2) |
| Can shared users rename a doc? | Yes, rename counts as editing; only the owner manages sharing and deletes |
| Do you have a domain for the AWS deploy? | Needed for HTTPS between CloudFront and EC2. Without one I fall back to the CloudFront URL and an HTTP-only origin locked to CloudFront |
| Infrastructure as code? | No. A documented setup script plus console steps; Terraform can come later |

**Cost estimate:** about $15/month on AWS (t4g.small + 20 GB disk; S3/CloudFront are pennies at this scale).

**To approve:** reply "plan approved" (with any changes), then review the Phase 1 doc. I start coding each phase only after you approve its doc.
