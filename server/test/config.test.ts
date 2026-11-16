import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config";

const VALID_ENV = {
  DATABASE_URL: "postgres://localhost/db",
  SESSION_SECRET: "a-secret-of-at-least-16-chars",
};

describe("loadConfig", () => {
  it("reads a valid configuration", () => {
    const config = loadConfig({
      ...VALID_ENV,
      PORT: "4000",
      NODE_ENV: "production",
    });

    expect(config).toEqual({
      port: 4000,
      databaseUrl: VALID_ENV.DATABASE_URL,
      sessionSecret: VALID_ENV.SESSION_SECRET,
      isProduction: true,
    });
  });

  it("reads the optional folder of the built frontend", () => {
    const config = loadConfig({ ...VALID_ENV, CLIENT_DIST_DIR: "/app/dist" });

    expect(config.clientDistDir).toBe("/app/dist");
  });

  it.each([
    [
      "DATABASE_URL is missing",
      { SESSION_SECRET: VALID_ENV.SESSION_SECRET },
      /DATABASE_URL/,
    ],
    [
      "SESSION_SECRET is missing",
      { DATABASE_URL: VALID_ENV.DATABASE_URL },
      /SESSION_SECRET/,
    ],
    [
      "SESSION_SECRET is too short",
      { ...VALID_ENV, SESSION_SECRET: "short" },
      /16 characters/,
    ],
  ])("fails with a clear message when %s", (_label, env, expectedMessage) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(expectedMessage);
  });
});
