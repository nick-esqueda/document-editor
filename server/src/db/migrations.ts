import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../migrations", import.meta.url),
);
const MIGRATIONS_TABLE = "pgmigrations";

export type MigrationDirection = "up" | "down";

/** Applies all pending migrations ("up") or rolls all of them back ("down"). */
export async function runMigrations(
  databaseUrl: string,
  direction: MigrationDirection,
): Promise<void> {
  await runner({
    databaseUrl,
    dir: MIGRATIONS_DIR,
    migrationsTable: MIGRATIONS_TABLE,
    direction,
    count: Infinity,
    log: () => {},
  });
}
