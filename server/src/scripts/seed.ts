import { loadConfig, loadEnvFileIfPresent } from "../config";
import { createPool } from "../db/pool";
import { SEED_USERS, seedUsers } from "../db/seedUsers";

async function seed(): Promise<void> {
  loadEnvFileIfPresent();
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);

  try {
    await seedUsers(pool, process.env.SEED_PASSWORD);
    const usernames = SEED_USERS.map((user) => user.username).join(", ");
    console.log(`Seeded users: ${usernames}`);
  } finally {
    await pool.end();
  }
}

await seed();
