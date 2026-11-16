import { describe, expect, it } from "vitest";
import { runMigrations } from "../src/db/migrations";
import { SeedError, seedUsers } from "../src/db/seedUsers";
import { getTestDatabaseUrl, TEST_SEED_PASSWORD } from "./support/testDatabase";
import { useTestPool } from "./support/testApp";

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$12\$/;

async function listUserTables(
  pool: ReturnType<typeof useTestPool>,
): Promise<string[]> {
  const result = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name IN ('users', 'session', 'documents', 'document_access')
     ORDER BY table_name`,
  );
  return result.rows.map((row) => row.table_name);
}

describe("migrations", () => {
  const pool = useTestPool();
  const databaseUrl = getTestDatabaseUrl();

  it("roll back and re-apply cleanly, including documents and access", async () => {
    await runMigrations(databaseUrl, "down");
    const tablesAfterDown = await listUserTables(pool);

    await runMigrations(databaseUrl, "up");
    await seedUsers(pool, TEST_SEED_PASSWORD);
    const tablesAfterUp = await listUserTables(pool);

    expect(tablesAfterDown).toEqual([]);
    expect(tablesAfterUp).toEqual([
      "document_access",
      "documents",
      "session",
      "users",
    ]);
  });
});

describe("seedUsers", () => {
  const pool = useTestPool();

  async function listSeededUsers() {
    const result = await pool.query<{
      username: string;
      password_hash: string;
    }>("SELECT username, password_hash FROM users ORDER BY username");
    return result.rows;
  }

  it("creates alice, bob and carol with bcrypt hashes", async () => {
    await seedUsers(pool, TEST_SEED_PASSWORD);
    const users = await listSeededUsers();

    expect(users.map((user) => user.username)).toEqual([
      "alice",
      "bob",
      "carol",
    ]);
    for (const user of users) {
      expect(user.password_hash).toMatch(BCRYPT_HASH_PATTERN);
      expect(user.password_hash).not.toContain(TEST_SEED_PASSWORD);
    }
  });

  it("can run twice without duplicating users", async () => {
    await seedUsers(pool, TEST_SEED_PASSWORD);
    await seedUsers(pool, TEST_SEED_PASSWORD);

    const users = await listSeededUsers();
    expect(users).toHaveLength(3);
  });

  it("stops with a clear error when SEED_PASSWORD is missing", async () => {
    await expect(seedUsers(pool, undefined)).rejects.toThrow(SeedError);
    await expect(seedUsers(pool, "")).rejects.toThrow(
      /SEED_PASSWORD is required/,
    );
  });
});
