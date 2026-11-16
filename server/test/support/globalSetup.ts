import { createPool } from "../../src/db/pool";
import { runMigrations } from "../../src/db/migrations";
import { seedUsers } from "../../src/db/seedUsers";
import { getTestDatabaseUrl, TEST_SEED_PASSWORD } from "./testDatabase";

/** Runs once before all server tests: wipes the test database, migrates and seeds it. */
export default async function setUpTestDatabase(): Promise<void> {
  const databaseUrl = getTestDatabaseUrl();
  const pool = createPool(databaseUrl);

  try {
    await pool.query("SELECT 1");
  } catch (error) {
    throw new Error(
      `Cannot reach the test database at TEST_DATABASE_URL: ${String(error)}`,
    );
  }

  try {
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await runMigrations(databaseUrl, "up");
    await seedUsers(pool, TEST_SEED_PASSWORD);
  } finally {
    await pool.end();
  }
}
