import { existsSync } from "node:fs";

const DEFAULT_PORT = 3000;
const MIN_SESSION_SECRET_LENGTH = 16;
const ENV_FILE_PATH = new URL("../../.env", import.meta.url);

export interface ServerConfig {
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  isProduction: boolean;
  /** Folder with the built React app. When set, the server also serves the frontend. */
  clientDistDir?: string;
}

type Env = Record<string, string | undefined>;

/**
 * Each check returns an error message, or null when the setting is fine.
 * To validate a new setting, add a check to this list.
 */
const CONFIG_CHECKS: Array<(env: Env) => string | null> = [
  (env) => (env.DATABASE_URL ? null : "DATABASE_URL is required"),
  (env) => (env.SESSION_SECRET ? null : "SESSION_SECRET is required"),
  (env) =>
    !env.SESSION_SECRET ||
    env.SESSION_SECRET.length >= MIN_SESSION_SECRET_LENGTH
      ? null
      : `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters`,
];

export class ConfigError extends Error {}

/** Loads the repo-root .env file into process.env, if it exists. Real env vars win. */
export function loadEnvFileIfPresent(): void {
  if (existsSync(ENV_FILE_PATH)) {
    process.loadEnvFile(ENV_FILE_PATH);
  }
}

/** Reads and validates server settings, throwing one error that lists every problem. */
export function loadConfig(env: Env = process.env): ServerConfig {
  const problems = CONFIG_CHECKS.map((check) => check(env)).filter(
    (problem): problem is string => problem !== null,
  );

  if (problems.length > 0) {
    const problemList = problems.join("; ");
    throw new ConfigError(`Invalid server configuration: ${problemList}`);
  }

  return {
    port: Number(env.PORT ?? DEFAULT_PORT),
    databaseUrl: env.DATABASE_URL as string,
    sessionSecret: env.SESSION_SECRET as string,
    isProduction: env.NODE_ENV === "production",
    clientDistDir: env.CLIENT_DIST_DIR || undefined,
  };
}
