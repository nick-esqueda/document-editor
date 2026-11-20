# Ajaia Doc Editor

A lightweight collaborative document editor: log in, write formatted documents, share them, and import `.txt`/`.md` files. Built in phases, see [docs/PLAN-SUMMARY.md](docs/PLAN-SUMMARY.md). This README grows into the full guide in Phase 5.

## Set up locally from Google Drive

Use this if you were sent the code as a Google Drive link.

**Google Drive link:** `TODO: add the Google Drive link here`

### What you need

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine with the Compose plugin), running.
- Ports 5173, 3000 and 5432 free on your machine.

Node isn't needed for this setup; everything runs in containers.

### 1. Download and unzip the code

1. Open the Google Drive link, then use **Download** on the `document-editor` folder. Drive zips the folder for you. Large folders can arrive as several zip files; unzip all of them into the same folder.
2. Unzip it somewhere convenient and open a terminal in the unzipped `document-editor` folder (the one that contains `docker-compose.yml`):

   ```sh
   cd path/to/document-editor
   ```

### 2. Create your `.env` file

```sh
cp .env.example .env
```

The defaults work as-is for local use. `SEED_PASSWORD` is the password every demo user gets, so change it if you like. `.env` is hidden in Finder and Explorer because its name starts with a dot; the command above works regardless.

### 3. Start the app

```sh
docker compose up --build
```

The first run takes a few minutes to build. Compose starts Postgres, the API (port 3000, runs migrations and the seed on start) and the Vite dev server (port 5173, forwards `/api` to the API). Wait until the logs show both the Vite dev server URL and `API listening on http://localhost:3000` before logging in.

### 4. Log in

Open http://localhost:5173 and log in as `alice`, `bob` or `carol` with the `SEED_PASSWORD` from your `.env` (`change-me-dev-password` unless you changed it). Log in as two of them in different browsers to try sharing.

To stop the app, press Ctrl+C, or run `docker compose down`. Your documents are kept in a Docker volume; `docker compose down -v` deletes them and starts fresh next time.

## Set up locally from GitHub

The code is also at https://github.com/nick-esqueda/document-editor. You need [Git](https://git-scm.com/downloads) plus the same prerequisites as [the Google Drive setup](#what-you-need).

1. Clone the repository and go into it:

   ```sh
   git clone https://github.com/nick-esqueda/document-editor.git
   cd document-editor
   ```

2. Follow the Google Drive setup from [step 2, Create your `.env` file](#2-create-your-env-file) onward: copy `.env.example` to `.env`, run `docker compose up --build`, and log in at http://localhost:5173.

To get later changes, run `git pull`, then `docker compose up --build --renew-anon-volumes`. That flag refreshes the installed packages in case dependencies changed, and keeps your database.

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
