# Phase 3: Sharing

**Goal:** an owner can give another user access to a document. Access means read + edit. The list clearly separates docs you own from docs shared with you.

## Scope

grant and revoke access, share dialog, "Shared with me" section, access checks widened to "owner or granted".

## Out of scope

Permission levels (view-only, comment), share links, sharing with people outside the seeded users, notifications, transferring ownership.

## Database

```sql
document_access (
  document_id  uuid references documents(id) on delete cascade,
  user_id      uuid references users(id)     on delete cascade,
  granted_by   uuid references users(id),
  created_at   timestamptz not null default now(),
  primary key (document_id, user_id)
)
index on document_access(user_id)
```

## Rules

| Action | Owner | User with access | Anyone else |
|---|---|---|---|
| Open, edit content | ✓ | ✓ | 404 |
| Rename | ✓ | ✓ *(default)* | 404 |
| See who has access | ✓ | ✓ (read-only list) | 404 |
| Grant / revoke access | ✓ | ✗ (403) | 404 |
| Delete document | ✓ | ✗ (403) | 404 |

- An owner can't share with themselves; sharing twice is a no-op.
- Revoking takes effect on the next request. If the revoked user has the doc open, their next save gets 404 and the editor shows *"You no longer have access to this document."*
- Two people editing at once is handled by the Phase 2 version check (409 + reload banner).

## API

| Method | Route | Who |
|---|---|---|
| GET | `/api/documents` | logged in → now returns `{ owned: [...], shared: [...] }`; shared items include owner's name |
| GET | `/api/users` | logged in → `id, username, displayName` for the share picker |
| GET | `/api/documents/:id/access` | owner or access |
| POST | `/api/documents/:id/access` | owner → `{ userId }` |
| DELETE | `/api/documents/:id/access/:userId` | owner |

`getAccessibleDoc` becomes one SQL query (`owner_id = $user OR EXISTS access row`) and also returns the caller's role (`owner` / `editor`), so routes can check ownership without a second query.

Listing all users is fine here because users are a small seeded set. With real sign-up, this would become search-by-exact-username.

## Wireframes

**Document list**
```text
┌────────────────────────────────────────────────────┐
│ 📄 DocEditor                      Alice ▾ [Log out] │
├────────────────────────────────────────────────────┤
│  My documents                   [ + New document ] │
│  ─────────────────────────────────────────────────  │
│  📄 Q3 planning notes   👥 2      Edited 2 min ago ⋮ │
│  📄 Reading list                  Edited Nov 10    ⋮ │
│                                                    │
│  Shared with me                                    │
│  ─────────────────────────────────────────────────  │
│  📄 Team retro         from Bob   Edited 1 hr ago   │
│  📄 Launch checklist   from Carol Edited Nov 12     │
│                                                    │
│  (empty: "Nothing shared with you yet.")           │
└────────────────────────────────────────────────────┘
```
`👥 2` = shared with 2 people.

**Share dialog** (opened from a **Share** button in the editor header, or ⋮ → Share in the list; owner only)
```text
        ┌──────────────────────────────────────┐
        │ Share "Q3 planning notes"         ✕  │
        ├──────────────────────────────────────┤
        │ Add people                           │
        │ [ Select a user…             ▾ ] [Add]│
        │    Bob                               │
        │    Carol                             │
        │                                      │
        │ People with access                   │
        │  Alice (you)              Owner      │
        │  Bob                      [Remove]   │
        │                                      │
        │ People with access can view and edit.│
        └──────────────────────────────────────┘
```

**Editor header, opened by someone it was shared with**
```text
┌────────────────────────────────────────────────────┐
│ ← Documents   [ Team retro ]  Owned by Bob ✓ Saved │
└────────────────────────────────────────────────────┘
```
No Share or Delete for non-owners. Instead they see "Owned by …", and clicking it shows the read-only list of people with access.

## Testing

API matrix test covering every row of the rules table for owner, granted user and stranger. Revoke-while-open test. Playwright: Alice shares with Bob, Bob logs in and edits, Alice reopens and sees Bob's change.

## Open questions

- **Can shared users rename?** *Default: yes.*
- **Can a shared user remove themselves ("leave")?** *Default: no, keep it simple.*

## Acceptance criteria

- [ ] `npm test` passes, including a matrix test covering every cell of the rules table for owner (alice), granted user (bob) and stranger (carol), with the exact status codes listed
- [ ] `curl -b alice POST /api/documents/:id/access -d '{"userId":"<bob>"}'` → 201; repeating it → 200 no-op; sharing with alice herself → 400
- [ ] `curl -b bob GET /api/documents` → doc appears under `shared` with `ownerName: "Alice"`, not under `owned`
- [ ] `curl -b bob POST .../access` and `DELETE /api/documents/:id` → 403; `curl -b carol GET /api/documents/:id` → 404
- [ ] Revoke: alice `DELETE .../access/<bob>` → bob's next `PATCH` → 404
- [ ] Concurrent edit: alice and bob both `PATCH` from version N → one 200, one 409
- [ ] Playwright: alice shares with bob → bob logs in, sees it under "Shared with me", edits → alice reopens and sees bob's change
- [ ] Playwright: as bob, the editor has no Share or Delete controls and shows "Owned by Alice"
