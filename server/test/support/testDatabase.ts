import { loadEnvFileIfPresent } from "../../src/config";

export const TEST_SEED_PASSWORD = "test-password-123";
export const TEST_SESSION_SECRET = "test-session-secret-at-least-16-chars";

// The test setup wipes this database, so it must clearly be a throwaway one.
const REQUIRED_TEST_DATABASE_SUFFIX = "_test";

/** Each check returns an error message, or null when the URL is safe to wipe. */
const TEST_DATABASE_CHECKS: Array<
  (testUrl: string, appUrl: string | undefined) => string | null
> = [
  (testUrl, appUrl) =>
    testUrl === appUrl
      ? "TEST_DATABASE_URL must not be the same as DATABASE_URL"
      : null,
  (testUrl) =>
    readDatabaseName(testUrl).endsWith(REQUIRED_TEST_DATABASE_SUFFIX)
      ? null
      : `The test database name must end in "${REQUIRED_TEST_DATABASE_SUFFIX}"`,
];

/**
 * Returns the test database URL, or throws. Tests never silently skip when
 * the database is missing: a missing database is a failed run. They also
 * refuse to run against anything that might be the app's real database.
 */
export function getTestDatabaseUrl(): string {
  loadEnvFileIfPresent();
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;

  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Server tests need a real Postgres database.",
    );
  }

  assertSafeToWipe(testDatabaseUrl, process.env.DATABASE_URL);
  return testDatabaseUrl;
}

export function assertSafeToWipe(
  testDatabaseUrl: string,
  appDatabaseUrl: string | undefined,
): void {
  const problems = TEST_DATABASE_CHECKS.map((check) =>
    check(testDatabaseUrl, appDatabaseUrl),
  );
  const firstProblem = problems.find((problem) => problem !== null);

  if (firstProblem) {
    throw new Error(`Refusing to run tests: ${firstProblem}`);
  }
}

function readDatabaseName(databaseUrl: string): string {
  const pathname = new URL(databaseUrl).pathname;
  return pathname.replace(/^\//, "");
}
