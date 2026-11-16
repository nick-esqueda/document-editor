/**
 * Wireframe screens, one entry per image. Each screen is a function that returns HTML.
 * To add a screen: write a function below and add it to SCREENS with the file name to render.
 * Shared pieces (header, document rows, editor chrome) are small helpers so screens stay consistent.
 */

const DEMO_ROWS = [
  { title: "Q3 planning notes", edited: "Edited 2 min ago" },
  { title: "Untitled document", edited: "Edited yesterday" },
  { title: "Reading list", edited: "Edited Nov 10" },
];

const SHARED_ROWS = [
  { title: "Team retro", owner: "Bob", edited: "Edited 1 hr ago" },
  { title: "Launch checklist", owner: "Carol", edited: "Edited Nov 12" },
];

function renderLabel(text) {
  return `<div class="label">${text}</div>`;
}

function renderAppHeader() {
  return `<div class="header">
    <div class="brand"><div class="logo"></div>DocEditor</div>
    <div class="spacer"></div>
    <div class="user"><div class="avatar">A</div>Alice</div>
    <button class="btn">Log out</button>
  </div>`;
}

function renderDocRow(row) {
  const sharedPill = row.sharedCount ? `<span class="pill">👥 Shared with ${row.sharedCount}</span>` : "";
  const ownerText = row.owner ? `<span class="meta">from ${row.owner}</span>` : "";
  const menuButton = row.hasMenu === false ? "" : `<span class="kebab">⋮</span>`;
  const openMenu = row.menu ? renderRowMenu(row.menu) : "";

  return `<div class="row">
    <div class="doc-icon"></div><span class="title">${row.title}</span>${sharedPill}${ownerText}
    <div class="spacer"></div><span class="meta">${row.edited}</span>${menuButton}${openMenu}
  </div>`;
}

function renderRowMenu(items) {
  const itemHtml = items.map((item) => `<div class="${item.isDanger ? "danger" : ""}">${item.text}</div>`);
  return `<div class="menu">${itemHtml.join("")}</div>`;
}

function renderDocSection(heading, rows, actionsHtml = "", hintHtml = "") {
  const rowHtml = rows.map(renderDocRow).join("");
  return `<div class="section-head"><h2>${heading}</h2>${hintHtml}<div class="spacer"></div>${actionsHtml}</div>
    <div class="rows">${rowHtml}</div>`;
}

function renderEditorBar({ title, status, extraHtml = "", isTitleFocused = false }) {
  const focusClass = isTitleFocused ? "focus" : "";
  return `<div class="editor-bar">
    <button class="btn ghost">← Documents</button>
    <span class="title-input ${focusClass}">${title}</span>
    ${extraHtml}<div class="spacer"></div>${status}
  </div>`;
}

const SAVED_STATUS = `<span class="status">✓ Saved</span>`;

function renderToolbar() {
  return `<div class="toolbar">
    <div class="tool select">Heading 1 <span>▾</span></div><div class="sep"></div>
    <div class="tool"><b>B</b></div><div class="tool on"><i>I</i></div><div class="tool"><u>U</u></div>
    <div class="sep"></div><div class="tool">• List</div><div class="tool">1. List</div>
    <div class="sep"></div><div class="tool">↶</div><div class="tool">↷</div>
  </div>`;
}

function renderSampleDocument() {
  return `<div class="paper">
    <h1>Q3 Planning</h1>
    <p>Goals for the quarter, agreed in the <i>Monday sync</i>:</p>
    <ul><li>Ship <b>sharing</b> to everyone</li><li><u>Deploy</u> to AWS</li><li>Write the README</li></ul>
    <h2>Open questions</h2>
    <ol><li>Do we need view-only access?</li><li>Who owns the launch checklist?<span class="caret"></span></li></ol>
  </div>`;
}

function renderLoginScreen({ hasError }) {
  const errorHtml = hasError ? `<div class="error-text">⚠ Invalid username or password</div>` : "";
  return `<div class="screen">${renderLabel(hasError ? "Phase 1 · Login (error)" : "Phase 1 · Login")}
    <div class="center"><div>
      <div class="brand" style="justify-content:center;margin-bottom:22px;font-size:24px"><div class="logo"></div>DocEditor</div>
      <div class="login-card">
        <div class="field-label">Username</div><div class="input">alice</div>
        <div class="field-label" style="margin-top:14px">Password</div><div class="input">••••••••••</div>
        ${errorHtml}
        <button class="btn primary" style="width:100%;justify-content:center;margin-top:18px;padding:9px">Log in</button>
      </div>
      <p class="hint" style="text-align:center;margin-top:14px">Demo users: alice, bob, carol (shown in local dev only)</p>
    </div></div></div>`;
}

function renderAppShell() {
  return `<div class="screen">${renderLabel("Phase 1 · After login")}${renderAppHeader()}
    <div class="page"><div class="empty" style="margin-top:80px;padding:60px">
      <div style="font-size:18px;color:var(--ink);font-weight:600">You're logged in</div>
      <div>Your documents will appear here in Phase 2.</div>
    </div></div></div>`;
}

function renderPhase2List() {
  const rows = DEMO_ROWS.map((row, index) =>
    index === 1 ? { ...row, menu: [{ text: "Rename" }, { text: "Delete", isDanger: true }] } : row,
  );
  const actions = `<button class="btn primary">+ New document</button>`;
  return `<div class="screen">${renderLabel("Phase 2 · Document list (row menu open)")}${renderAppHeader()}
    <div class="page">${renderDocSection("My documents", rows, actions)}</div></div>`;
}

function renderPhase2EmptyList() {
  const actions = `<button class="btn primary">+ New document</button>`;
  return `<div class="screen">${renderLabel("Phase 2 · Document list (empty)")}${renderAppHeader()}
    <div class="page"><div class="section-head"><h2>My documents</h2><div class="spacer"></div>${actions}</div>
      <div class="empty">No documents yet. Click <b>New document</b> to create one.</div></div></div>`;
}

function renderPhase2Editor() {
  return `<div class="screen">${renderLabel("Phase 2 · Editor")}
    ${renderEditorBar({ title: "Q3 planning notes", status: SAVED_STATUS, isTitleFocused: true })}
    ${renderToolbar()}${renderSampleDocument()}</div>`;
}

function renderPhase2Conflict() {
  const saving = `<span class="status" style="color:var(--muted)">Not saved</span>`;
  return `<div class="screen">${renderLabel("Phase 2 · Edit conflict")}
    ${renderEditorBar({ title: "Q3 planning notes", status: saving })}
    <div class="banner warn">⚠ <span>This document was changed elsewhere. Your latest edits weren't saved. Copy them if you need them, then reload.</span>
      <div class="spacer"></div><button class="btn">Reload</button></div>
    ${renderToolbar()}${renderSampleDocument()}</div>`;
}

function renderPhase2Offline() {
  const offline = `<span class="status" style="color:#9a6700">⟳ Offline, retrying…</span>`;
  return `<div class="screen">${renderLabel("Phase 2 · Save status: offline")}
    ${renderEditorBar({ title: "Q3 planning notes", status: offline })}
    ${renderToolbar()}${renderSampleDocument()}</div>`;
}

function renderPhase3List() {
  const owned = [{ ...DEMO_ROWS[0], sharedCount: 2 }, DEMO_ROWS[2]];
  const shared = SHARED_ROWS.map((row) => ({ ...row, hasMenu: false }));
  const actions = `<button class="btn primary">+ New document</button>`;
  return `<div class="screen">${renderLabel("Phase 3 · Owned vs shared")}${renderAppHeader()}
    <div class="page">${renderDocSection("My documents", owned, actions)}
      <div style="height:26px"></div>${renderDocSection("Shared with me", shared)}</div></div>`;
}

function renderPhase3ShareDialog() {
  const shareButton = `<button class="btn primary" style="margin-right:10px">Share</button>`;
  return `<div class="screen">${renderLabel("Phase 3 · Share dialog (owner)")}
    ${renderEditorBar({ title: "Q3 planning notes", status: shareButton + SAVED_STATUS })}
    ${renderToolbar()}${renderSampleDocument()}
    <div class="overlay"><div class="dialog">
      <div class="dialog-head">Share "Q3 planning notes"<div class="spacer"></div><span class="muted">✕</span></div>
      <div class="dialog-body">
        <div class="field-label">Add people</div>
        <div style="display:flex;gap:8px"><div class="input placeholder">Select a user…  ▾</div><button class="btn primary">Add</button></div>
        <div class="select-list" style="width:372px"><div class="hl">Carol</div></div>
        <div class="field-label" style="margin-top:18px">People with access</div>
        <div class="person"><div class="avatar">A</div>Alice (you)<div class="spacer"></div><span class="muted">Owner</span></div>
        <div class="person"><div class="avatar">B</div>Bob<div class="spacer"></div><button class="btn">Remove</button></div>
        <p class="hint" style="margin:12px 0 0">People with access can view and edit this document.</p>
      </div></div></div></div>`;
}

function renderPhase3SharedEditor() {
  const owner = `<span class="pill">Owned by Bob</span>`;
  return `<div class="screen">${renderLabel("Phase 3 · Editor, opened by a shared user")}
    ${renderEditorBar({ title: "Team retro", status: SAVED_STATUS, extraHtml: owner })}
    ${renderToolbar()}${renderSampleDocument()}</div>`;
}

function renderPhase3RevokedEditor() {
  return `<div class="screen">${renderLabel("Phase 3 · Access removed while open")}
    ${renderEditorBar({ title: "Team retro", status: `<span class="status" style="color:var(--danger)">Not saved</span>` })}
    <div class="banner danger">⛔ <span>You no longer have access to this document.</span><div class="spacer"></div><button class="btn">Back to documents</button></div>
    ${renderToolbar()}${renderSampleDocument()}</div>`;
}

function renderUploadActions() {
  return `<button class="btn">⬆ Upload</button><button class="btn primary">+ New document</button>`;
}

const UPLOAD_HINT = `<span class="hint">Upload supports .txt and .md, up to 1 MB</span>`;

function renderPhase4List() {
  const rows = [{ title: "meeting-notes", edited: "Edited just now" }, ...DEMO_ROWS];
  return `<div class="screen">${renderLabel("Phase 4 · Upload button")}${renderAppHeader()}
    <div class="page">${renderDocSection("My documents", rows, renderUploadActions(), UPLOAD_HINT)}</div>
    <div class="toast">⏳ <span>Importing <b>meeting-notes.md</b>…</span></div></div>`;
}

function renderPhase4DragDrop() {
  return `<div class="screen">${renderLabel("Phase 4 · Drag and drop")}${renderAppHeader()}
    <div class="page">${renderDocSection("My documents", DEMO_ROWS, renderUploadActions(), UPLOAD_HINT)}</div>
    <div class="drop">Drop a .txt or .md file to import it</div></div>`;
}

function renderPhase4Error() {
  return `<div class="screen">${renderLabel("Phase 4 · Unsupported file")}${renderAppHeader()}
    <div class="page">${renderDocSection("My documents", DEMO_ROWS, renderUploadActions(), UPLOAD_HINT)}</div>
    <div class="toast error">✕ <span><b>"report.docx" isn't supported.</b><br>Upload a .txt or .md file up to 1 MB.</span></div></div>`;
}

function renderPhase4ImportedEditor() {
  return `<div class="screen">${renderLabel("Phase 4 · Imported document")}
    ${renderEditorBar({ title: "meeting-notes", status: SAVED_STATUS })}
    <div class="banner info">ℹ <span>Imported from <b>meeting-notes.md</b>. Some formatting (a table) wasn't supported and was simplified.</span><div class="spacer"></div><span>✕</span></div>
    ${renderToolbar()}${renderSampleDocument()}</div>`;
}

function renderBox(title, detail, style = "") {
  return `<div style="border:1.5px solid var(--line);border-radius:10px;padding:12px 16px;background:#fff;${style}">
    <div style="font-weight:700">${title}</div><div class="hint">${detail}</div></div>`;
}

function renderArrow(text) {
  return `<div style="display:flex;flex-direction:column;align-items:center;color:var(--muted);font-size:13px">
    <span>${text}</span><span style="font-size:22px;line-height:1">→</span></div>`;
}

function renderPhase5Architecture() {
  const ec2Contents = [
    renderBox("Caddy", "HTTPS on :443, Let's Encrypt certificate"),
    renderBox("API container", "Express on :3000, runs migrations on start"),
    renderBox("Postgres container", "Data on the EBS disk, no public port"),
  ].join('<div style="text-align:center;color:var(--muted)">↓</div>');

  return `<div class="screen" style="background:var(--panel)">${renderLabel("Phase 5 · AWS architecture")}
    <div style="padding:40px 48px">
      <h2 style="margin:0 0 6px">How the app runs on AWS</h2>
      <p class="hint" style="margin:0 0 30px">One domain for everything, so the login cookie is first-party and there's no CORS.</p>
      <div style="display:flex;align-items:center;gap:18px">
        ${renderBox("Browser", "your-domain.com", "width:150px")}
        ${renderArrow("HTTPS")}
        ${renderBox("CloudFront", "Single front door. Routes by path.", "width:200px;border-color:var(--accent)")}
        <div style="display:flex;flex-direction:column;gap:28px;flex:1">
          <div style="display:flex;align-items:center;gap:18px">${renderArrow("/*")}
            <div style="flex:1">${renderBox("S3 bucket (private)", "React build. Only CloudFront can read it.")}</div></div>
          <div style="display:flex;align-items:center;gap:18px">${renderArrow("/api/*")}
            <div style="flex:1;border:2px dashed var(--accent);border-radius:12px;padding:14px;background:var(--accent-soft)">
              <div style="font-weight:700;margin-bottom:10px">EC2 t4g.small · Docker Compose</div>${ec2Contents}
            </div></div>
        </div>
      </div>
      <div style="display:flex;gap:18px;margin-top:30px">
        ${renderBox("Nightly backup", "pg_dump to a separate S3 bucket, kept 14 days", "flex:1")}
        ${renderBox("Secrets", "AWS Parameter Store, never in git", "flex:1")}
        ${renderBox("Admin access", "Session Manager. No SSH port open.", "flex:1")}
        ${renderBox("Cost", "About $15 / month", "flex:1")}
      </div>
    </div></div>`;
}

/** File name (without .png) → screen renderer. */
const SCREENS = {
  "phase-1-login": () => renderLoginScreen({ hasError: false }),
  "phase-1-login-error": () => renderLoginScreen({ hasError: true }),
  "phase-1-app-shell": renderAppShell,
  "phase-2-document-list": renderPhase2List,
  "phase-2-document-list-empty": renderPhase2EmptyList,
  "phase-2-editor": renderPhase2Editor,
  "phase-2-editor-offline": renderPhase2Offline,
  "phase-2-editor-conflict": renderPhase2Conflict,
  "phase-3-document-list": renderPhase3List,
  "phase-3-share-dialog": renderPhase3ShareDialog,
  "phase-3-editor-shared-user": renderPhase3SharedEditor,
  "phase-3-editor-access-removed": renderPhase3RevokedEditor,
  "phase-4-document-list-upload": renderPhase4List,
  "phase-4-drag-and-drop": renderPhase4DragDrop,
  "phase-4-upload-error": renderPhase4Error,
  "phase-4-imported-document": renderPhase4ImportedEditor,
  "phase-5-architecture": renderPhase5Architecture,
};

module.exports = { SCREENS };
