import { AppHeader } from "../components/AppHeader";

/** Placeholder home screen. Phase 2 replaces the body with the document list. */
export function HomePage() {
  return (
    <>
      <AppHeader />
      <main className="page">
        <div className="empty-state">
          <h2>You're logged in</h2>
          <p>Your documents will appear here in Phase 2.</p>
        </div>
      </main>
    </>
  );
}
