import { afterAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp, type AppOptions } from "../../src/app";
import { createPool, type DbPool } from "../../src/db/pool";
import { SESSION_COOKIE_NAME } from "../../src/auth/sessionMiddleware";
import {
  getTestDatabaseUrl,
  TEST_SEED_PASSWORD,
  TEST_SESSION_SECRET,
} from "./testDatabase";

export const LOGIN_PATH = "/api/auth/login";
export const LOGOUT_PATH = "/api/auth/logout";
export const CURRENT_USER_PATH = "/api/auth/me";

/** A connection pool for one test file. Closed automatically after the file's tests. */
export function useTestPool(): DbPool {
  const pool = createPool(getTestDatabaseUrl());
  afterAll(() => pool.end());
  return pool;
}

/** High enough that ordinary tests never hit it. The rate limit test sets the real limit. */
const TEST_LOGIN_RATE_LIMIT = { windowMs: 60_000, maxAttempts: 1000 };

export function createTestApp(
  pool: DbPool,
  overrides: Partial<AppOptions> = {},
): Express {
  return createApp({
    pool,
    sessionSecret: TEST_SESSION_SECRET,
    isProduction: false,
    shouldPruneExpiredSessions: false,
    loginRateLimit: TEST_LOGIN_RATE_LIMIT,
    ...overrides,
  });
}

export function postLogin(
  app: Express,
  username: string,
  password = TEST_SEED_PASSWORD,
) {
  return request(app).post(LOGIN_PATH).send({ username, password });
}

/** Logs in and returns the session cookie ("name=value") to send on later requests. */
export async function logInAndGetCookie(
  app: Express,
  username: string,
): Promise<string> {
  const response = await postLogin(app, username);
  return getSessionCookie(response.headers["set-cookie"]);
}

export function getSessionCookie(
  setCookieHeader: string[] | string | undefined,
): string {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader ?? ""];
  const sessionCookie = cookies.find((cookie) =>
    cookie.startsWith(`${SESSION_COOKIE_NAME}=`),
  );

  if (!sessionCookie) {
    throw new Error("Response did not set a session cookie");
  }

  return sessionCookie.split(";")[0];
}
