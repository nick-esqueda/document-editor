# Phase 4: Upload `.txt` / `.md`

**Goal:** a user uploads a `.txt` or `.md` file and it becomes a new document they own, which they can edit like any other.

## Scope

`.txt` and `.md`, up to 1 MB, one file at a time; supported types stated in the UI and README.

## Out of scope

`.docx` (stretch, via mammoth.js), `.pdf`, `.html`, images, importing into an existing doc, bulk upload.

## How it works

```text
browser ──multipart──▶ POST /api/documents/import
                          │ 1. check extension (.txt/.md) and size ≤ 1 MB
                          │ 2. decode as UTF-8; reject binary (NUL bytes / invalid UTF-8)
                          │ 3. convert
                          │      .md  → markdown-it (html: false) → HTML → Tiptap JSON
                          │      .txt → paragraphs split on blank lines,
                          │             single newlines become line breaks
                          │ 4. validate against the shared editor schema (same as Phase 2)
                          │ 5. insert document, owner = session user
                          ▼
                       201 { id }  → browser opens /d/:id
```

- **Conversion happens on the server**, using Tiptap's server-side `generateJSON` with the same extension list as the editor. Stored content is always valid editor JSON.
- **`html: false` in markdown-it** means raw HTML inside markdown is treated as text, never executed. The schema step is a second safety net.
- **Title** = filename without extension (e.g. `meeting-notes.md` → "meeting-notes").
- **Lossy by design:** markdown features the editor doesn't support are simplified. H4-H6 → H3, code blocks and blockquotes → paragraphs, tables → text, links → link text, images → dropped. The upload response includes a `warnings` count, and the UI shows *"Some formatting wasn't supported and was simplified."*
- multer with memory storage and a 1 MB limit. Nothing is written to disk.

## API

| Method | Route | Notes |
|---|---|---|
| POST | `/api/documents/import` | multipart field `file`. 201 `{id, warnings}` · 400 bad type/encoding · 413 too large |

## Wireframes

**Document list with upload**
```text
┌────────────────────────────────────────────────────┐
│ 📄 DocEditor                      Alice ▾ [Log out] │
├────────────────────────────────────────────────────┤
│  My documents      [ ⬆ Upload ]  [ + New document ] │
│                    Supports .txt and .md, up to 1 MB│
│  ─────────────────────────────────────────────────  │
│  📄 meeting-notes                Edited just now  ⋮ │
│  📄 Q3 planning notes            Edited 2 min ago ⋮ │
│  …                                                 │
└────────────────────────────────────────────────────┘
```
Clicking **Upload** opens the file picker filtered to `.txt,.md`. Dropping a file anywhere on the list also works.

**Upload states** (toast, bottom of the screen)
```text
 ┌────────────────────────────────────┐
 │ ⏳ Importing meeting-notes.md…      │
 └────────────────────────────────────┘
 ┌────────────────────────────────────────────────┐
 │ ✕ "report.docx" isn't supported.               │
 │   Upload a .txt or .md file.                   │
 └────────────────────────────────────────────────┘
 ┌────────────────────────────────────────────────┐
 │ ✕ "huge.md" is larger than 1 MB.               │
 └────────────────────────────────────────────────┘
```
On success the new document opens in the editor. If anything was simplified, a dismissible note sits above the toolbar:
```text
┌────────────────────────────────────────────────────┐
│ ℹ Imported from meeting-notes.md. Some formatting   │
│   wasn't supported and was simplified.        [ ✕ ]│
└────────────────────────────────────────────────────┘
```

## Testing

Unit tests on the converters with fixture files: headings, nested lists, bold/italic, raw `<script>` in markdown (comes out as text), Windows line endings, empty file, UTF-8 with BOM, a binary file renamed to `.txt`. API tests for type, size and ownership of the new doc.

## Stretch: `.docx`

Same pipeline with mammoth.js as step 3 (`.docx` → HTML → Tiptap JSON). Main extra risks are zip-bomb style files and larger sizes, so it would get its own limits. Separate proposal if you want it after Phase 5.

## Acceptance criteria

- [ ] `npm test` passes, including converter unit tests over `server/test/fixtures/import/` (headings, nested lists, bold/italic, `<script>` in markdown, CRLF, empty file, UTF-8 BOM, binary renamed to `.txt`)
- [ ] `curl -b alice -F file=@fixtures/sample.md POST /api/documents/import` → 201 `{id, warnings: 0}`; `GET /api/documents/:id` → content has `heading`, `bulletList`, `bold` nodes/marks and `owner_id` = alice
- [ ] `sample.txt` upload → paragraphs match the blank-line splits in the file
- [ ] `<script>alert(1)</script>` inside a `.md` file → stored as literal text; `jq` over the stored JSON finds no node type outside the editor schema
- [ ] Markdown with a table and an H5 → 201 with `warnings > 0`; H5 stored as H3
- [ ] `report.docx` → 400; 2 MB `.md` → 413; PNG renamed to `.txt` → 400; no cookie → 401
- [ ] `grep -n "txt" README.md` shows the supported-types line
- [ ] Playwright: Upload button opens a picker limited to `.txt,.md`; uploading `sample.md` opens the new doc in the editor; uploading `report.docx` shows the "isn't supported" toast
