# Phase 2: Documents + editor

**Goal:** a logged-in user can create a document, rename it, format text, have it autosave, and reopen it later. Documents are private to their owner in this phase.

## Scope

document list (owned docs), create, rename, open, Tiptap editor with toolbar, debounced autosave, save status, version conflict check, owner-only delete *(default, see open questions)*.

## Out of scope

Sharing (Phase 3), upload (Phase 4), comments, version history, images, tables, links.

## Database

```sql
documents (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references users(id) on delete cascade,
  title       text not null default 'Untitled document',  -- max 200 chars
  content     jsonb not null,           -- Tiptap/ProseMirror JSON
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
)
index on documents(owner_id, updated_at desc)
```

## API

| Method | Route | Who | Notes |
|---|---|---|---|
| GET | `/api/documents` | logged in | owned docs, newest first (no content) |
| POST | `/api/documents` | logged in | creates empty doc, returns it |
| GET | `/api/documents/:id` | has access | title, content, version |
| PATCH | `/api/documents/:id` | has access | `{title?, content?, version}` → 409 if version is stale |
| DELETE | `/api/documents/:id` | owner | |

**Access check:** one helper, `getAccessibleDoc(userId, docId)`, used by every `:id` route. In this phase it means "owner". Phase 3 widens it to "owner or granted". No access returns **404**, not 403, so IDs don't reveal that a doc exists.

**Content validation:** the server parses incoming JSON with ProseMirror's `Node.fromJSON` using the shared editor schema. Unknown nodes, marks or attributes are rejected with 400. Body limit 1 MB. We never store or render raw HTML.

## Editor

Tiptap with only what we need: paragraph, heading (H1-H3), bold, italic, underline, bullet list, numbered list, hard break, undo/redo. Standard shortcuts work (Ctrl/Cmd+B, I, U, Z). Markdown-style input rules (`# `, `- `, `1. `) come free with Tiptap.

## Autosave

- Save 1 s after typing stops, and at least every 5 s while typing continues.
- Title saves on blur / Enter.
- Status in the header: **Saving…** → **Saved** → **Offline, retrying** (exponential backoff).
- On tab close with unsaved changes: one last `fetch(..., {keepalive: true})` plus the browser "leave page?" prompt.
- **Conflict:** each save sends the `version` it was based on. If someone else saved in between (possible after Phase 3), the server returns 409 and the editor shows a banner: *"This document was changed elsewhere. Reload to see the latest version."* Your unsaved text is kept in the editor so you can copy it. Simple, and nothing gets silently overwritten.

## Wireframes

**Document list**
```text
┌────────────────────────────────────────────────────┐
│ 📄 DocEditor                      Alice ▾ [Log out] │
├────────────────────────────────────────────────────┤
│  My documents                   [ + New document ] │
│  ─────────────────────────────────────────────────  │
│  📄 Q3 planning notes            Edited 2 min ago ⋮ │
│  📄 Untitled document            Edited yesterday ⋮ │
│  📄 Reading list                 Edited Nov 10    ⋮ │
│                                    ⋮ → Rename       │
│                                        Delete       │
│                                                    │
│  (empty state: "No documents yet. Create one.")    │
└────────────────────────────────────────────────────┘
```

**Editor**
```text
┌────────────────────────────────────────────────────┐
│ ← Documents   [ Q3 planning notes        ]  ✓ Saved │
│               ↑ click title to rename               │
├────────────────────────────────────────────────────┤
│ [Normal ▾] │ B  I  U │ • List  1. List │ ↶ ↷        │
│  Normal / H1 / H2 / H3                              │
├────────────────────────────────────────────────────┤
│                                                    │
│   Q3 Planning                     ← H1             │
│                                                    │
│   Goals for the quarter:                           │
│    • Ship sharing                                  │
│    • **Deploy** to AWS                             │
│                                                    │
│   |                               ← cursor         │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Conflict banner** (top of the editor)
```text
┌────────────────────────────────────────────────────┐
│ ⚠ This document was changed elsewhere.  [ Reload ] │
└────────────────────────────────────────────────────┘
```

## Testing

API tests: create/list/get/patch; another user gets 404 on every route; invalid content rejected; stale version → 409. One Playwright smoke test: log in, create doc, type, reload, text is still there.

## Open questions

- **Delete:** include owner-only delete? *Default: yes.*
- **Trash/undo delete:** *Default: no, a confirm dialog is enough.*

## Acceptance criteria

- [ ] `npm test` passes, including an API suite that, as alice (owner) vs bob (stranger), checks every `/api/documents/:id` route: owner → 2xx, bob → 404
- [ ] `curl -b alice POST /api/documents` → 201; `GET /api/documents` lists it; `PATCH` with `{title:"X", version:1}` → 200 with `version: 2`
- [ ] `PATCH` again with `version: 1` → 409
- [ ] `PATCH` with content containing an unknown node (e.g. `{"type":"script"}`) or an unknown mark → 400; a 2 MB body → 413
- [ ] `PATCH` with a body containing `owner_id` or `userId` → ignored (owner unchanged in `psql`)
- [ ] `DELETE` as owner → 204, then `GET` → 404
- [ ] Playwright: log in, create doc, apply bold, italic, underline, H1, bulleted and numbered list, wait for "Saved", reload → identical content and formatting
- [ ] Playwright: stop the server container → status shows "Offline, retrying"; start it → returns to "Saved" with no lost text
- [ ] Playwright: rename from the list and from the editor header, both persist after reload
