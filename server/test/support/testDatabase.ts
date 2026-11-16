import { loadEnvFileIfPresent } from "../../src/config";

export const TEST_SEED_PASSWORD = "test-password-123";
export const TEST_SESSION_SECRET = "test-session-secret-at-least-16-chars";

/**
 * Returns the test database URL, or throws. Tests never silently skip when
 * the database is missing: a missing database is a failed run.
 */
export function getTestDatabaseUrl(): string {
  loadEnvFileIfPresent();
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;

  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Server tests need a real Postgres database.",
    );
  }

  return testDatabaseUrl;
}
