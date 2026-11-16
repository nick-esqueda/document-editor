# Ajaia Doc Editor

A lightweight collaborative document editor: log in, write formatted documents, share them, and import `.txt`/`.md` files. Built in phases, see [docs/PLAN-SUMMARY.md](docs/PLAN-SUMMARY.md). This README grows into the full guide in Phase 5.

## Run it locally

Requires Docker.

```sh
cp .env.example .env
docker compose up --build
```

Open http://localhost:5173 and log in as `alice`, `bob` or `carol` with the `SEED_PASSWORD` from your `.env`.

Compose starts Postgres, the API (port 3000, runs migrations and the seed on start) and the Vite dev server (port 5173, forwards `/api` to the API).

## Importing files

The **Upload** button on the document list (or dragging a file onto the list) turns a file into a new document you own.

- **Supported types:** `.txt` and `.md`, up to 1 MB, UTF-8 text. Other types (including `.docx` and `.pdf`) are rejected.
- **Plain text:** blank lines separate paragraphs; single line breaks are kept.
- **Markdown:** headings, bold, italic, bullet and numbered lists are kept. Features the editor doesn't have are simplified, and the editor says so: H4-H6 become H3, code blocks and quotes become plain paragraphs, links keep only their text, tables become one line per row, images and horizontal rules are dropped. Raw HTML is kept as literal text.
- The converted document must also fit the normal document size limit, so it can always be saved afterwards.

## Develop without Docker for the app

Postgres still runs in Docker; the API and client run on your machine (Node 22).

```sh
npm install
docker compose up -d db
npm run migrate -w server && npm run seed -w server
npm run dev
```

## Checks

| Command                | What it runs                                                     |
| ---------------------- | ---------------------------------------------------------------- |
| `npm test`             | Server tests (real Postgres test database) and client tests      |
| `npm run test:e2e`     | Playwright end-to-end tests (starts the app if it isn't running) |
| `npm run lint`         | ESLint                                                           |
| `npm run typecheck`    | TypeScript in every package                                      |
| `npm run format:check` | Prettier                                                         |

Server tests need `TEST_DATABASE_URL` (see `.env.example`). Compose creates that database the first time the Postgres volume starts. If the test database is unreachable, the run fails rather than skipping.

## Code style

Every change follows [CODE-STYLE.md](CODE-STYLE.md).
