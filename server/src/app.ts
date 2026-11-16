import express, { type Express } from "express";
import type { DbPool } from "./db/pool";
import { createSessionMiddleware } from "./auth/sessionMiddleware";
import {
  createLoginRateLimiter,
  DEFAULT_LOGIN_RATE_LIMIT,
  type LoginRateLimit,
} from "./auth/loginRateLimiter";
import { createAuthRouter } from "./routes/authRoutes";
import { createDocumentRouter } from "./routes/documentRoutes";
import { createUserRouter } from "./routes/userRoutes";
import { requireJsonBody } from "./http/requireJsonBody";
import { errorHandler } from "./http/errorHandler";
import { sendError } from "./http/sendError";
import { serveClientApp } from "./http/serveClientApp";

const JSON_BODY_LIMIT = "1mb";
const TRUSTED_PROXY_HOPS = 1;

export interface AppOptions {
  pool: DbPool;
  sessionSecret: string;
  isProduction: boolean;
  clientDistDir?: string;
  shouldPruneExpiredSessions?: boolean;
  loginRateLimit?: LoginRateLimit;
}

/** Builds the Express app. Kept separate from listen() so tests can create their own copy. */
export function createApp(options: AppOptions): Express {
  const app = express();

  // In production the app sits behind Render's load balancer, which terminates HTTPS.
  if (options.isProduction) {
    app.set("trust proxy", TRUSTED_PROXY_HOPS);
  }

  if (options.clientDistDir) {
    serveClientApp(app, options.clientDistDir);
  }

  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(
    createSessionMiddleware({
      pool: options.pool,
      sessionSecret: options.sessionSecret,
      isProduction: options.isProduction,
      shouldPruneExpiredSessions: options.shouldPruneExpiredSessions ?? true,
    }),
  );

  app.use("/api", requireJsonBody);
  app.use(
    "/api/auth",
    createAuthRouter({
      pool: options.pool,
      loginRateLimiter: createLoginRateLimiter(
        options.loginRateLimit ?? DEFAULT_LOGIN_RATE_LIMIT,
      ),
    }),
  );
  app.use("/api/documents", createDocumentRouter(options.pool));
  app.use("/api/users", createUserRouter(options.pool));
  app.use("/api", (_request, response) =>
    sendError(response, 404, "Not found"),
  );

  app.use(errorHandler);
  return app;
}
