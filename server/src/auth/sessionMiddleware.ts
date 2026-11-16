import type { RequestHandler } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { DbPool } from "../db/pool";

export const SESSION_COOKIE_NAME = "doc_editor_sid";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const EXPIRED_SESSION_PRUNE_INTERVAL_SECONDS = 15 * 60;

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

export interface SessionOptions {
  pool: DbPool;
  sessionSecret: string;
  isProduction: boolean;
  shouldPruneExpiredSessions: boolean;
}

/** Sessions live in Postgres. The cookie only holds a signed session id. */
export function createSessionMiddleware(
  options: SessionOptions,
): RequestHandler {
  const PgSessionStore = connectPgSimple(session);
  const pruneInterval = options.shouldPruneExpiredSessions
    ? EXPIRED_SESSION_PRUNE_INTERVAL_SECONDS
    : false;

  const store = new PgSessionStore({
    pool: options.pool,
    pruneSessionInterval: pruneInterval,
  });

  return session({
    name: SESSION_COOKIE_NAME,
    secret: options.sessionSecret,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: options.isProduction,
      maxAge: SESSION_MAX_AGE_MS,
    },
  });
}
