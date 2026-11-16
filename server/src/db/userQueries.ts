import type { PublicUser } from "@doc-editor/shared";
import type { DbPool } from "./pool";

/** A user row including the password hash. Never send this to the browser. */
export interface UserWithPasswordHash extends PublicUser {
  passwordHash: string;
}

export interface NewUser {
  username: string;
  displayName: string;
  passwordHash: string;
}

const USER_COLUMNS = `id, username, display_name AS "displayName"`;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export async function findUserWithPasswordHash(
  pool: DbPool,
  username: string,
): Promise<UserWithPasswordHash | null> {
  const result = await pool.query<UserWithPasswordHash>(
    `SELECT ${USER_COLUMNS}, password_hash AS "passwordHash" FROM users WHERE username = $1`,
    [normalizeUsername(username)],
  );

  return result.rows[0] ?? null;
}

export async function findPublicUserById(
  pool: DbPool,
  userId: string,
): Promise<PublicUser | null> {
  const result = await pool.query<PublicUser>(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
    [userId],
  );

  return result.rows[0] ?? null;
}

/** Inserts the user, or updates name and password if the username already exists. */
export async function upsertUser(pool: DbPool, user: NewUser): Promise<void> {
  await pool.query(
    `INSERT INTO users (username, display_name, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (username)
     DO UPDATE SET display_name = EXCLUDED.display_name, password_hash = EXCLUDED.password_hash`,
    [normalizeUsername(user.username), user.displayName, user.passwordHash],
  );
}

/** Converts a user row with a password hash into the browser-safe shape. */
export function toPublicUser(user: UserWithPasswordHash): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
  };
}

/** Every user, for the share picker. Fine while users are a small seeded set. */
export async function listPublicUsers(pool: DbPool): Promise<PublicUser[]> {
  const result = await pool.query<PublicUser>(
    `SELECT ${USER_COLUMNS} FROM users ORDER BY display_name`,
  );

  return result.rows;
}
