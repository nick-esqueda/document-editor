import { hashPassword } from "../auth/passwords";
import type { DbPool } from "./pool";
import { upsertUser } from "./userQueries";

/** The demo users. To add one, add an entry here and re-run the seed. */
export const SEED_USERS = [
  { username: "alice", displayName: "Alice" },
  { username: "bob", displayName: "Bob" },
  { username: "carol", displayName: "Carol" },
];

export class SeedError extends Error {}

/** Creates the demo users, or resets their name and password if they exist. Safe to re-run. */
export async function seedUsers(
  pool: DbPool,
  seedPassword: string | undefined,
): Promise<void> {
  if (!seedPassword) {
    throw new SeedError("SEED_PASSWORD is required to seed the demo users");
  }

  const passwordHash = await hashPassword(seedPassword);

  for (const seedUser of SEED_USERS) {
    await upsertUser(pool, { ...seedUser, passwordHash });
  }
}
