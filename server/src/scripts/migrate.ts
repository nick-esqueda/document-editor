import { loadConfig, loadEnvFileIfPresent } from "../config";
import { runMigrations, type MigrationDirection } from "../db/migrations";

const DIRECTION_BY_ARGUMENT: Record<string, MigrationDirection> = {
  up: "up",
  down: "down",
};

/** Usage: npm run migrate [-- up|down]. Defaults to "up". */
async function migrate(): Promise<void> {
  loadEnvFileIfPresent();
  const config = loadConfig();

  const directionArgument = process.argv[2] ?? "up";
  const direction = DIRECTION_BY_ARGUMENT[directionArgument];

  if (!direction) {
    throw new Error(
      `Unknown direction "${directionArgument}". Use "up" or "down".`,
    );
  }

  await runMigrations(config.databaseUrl, direction);
  console.log(`Migrations ${direction}: done`);
}

await migrate();
