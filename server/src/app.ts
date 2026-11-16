import express, { type Express } from "express";
import { MAX_SAVE_BODY_BYTES } from "@doc-editor/shared";
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
import { createRequireJsonBody } from "./http/requireJsonBody";
import { errorHandler } from "./http/errorHandler";
import { sendError } from "./http/sendError";

const TRUSTED_PROXY_HOPS = 1;

/** Routes under /api that take a file upload (multipart) instead of a JSON body. */
const UPLOAD_PATHS = ["/documents/import"];

export interface AppOptions {
  pool: DbPool;
  sessionSecret: string;
  isProduction: boolean;
  shouldPruneExpiredSessions?: boolean;
  loginRateLimit?: LoginRateLimit;
}

/** Builds the Express app. Kept separate from listen() so tests can create their own copy. */
export function createApp(options: AppOptions): Express {
  const app = express();

  // In production the app sits behind CloudFront and Caddy, which terminate HTTPS.
  if (options.isProduction) {
    app.set("trust proxy", TRUSTED_PROXY_HOPS);
  }

  app.use(express.json({ limit: MAX_SAVE_BODY_BYTES }));
  app.use(
    createSessionMiddleware({
      pool: options.pool,
      sessionSecret: options.sessionSecret,
      isProduction: options.isProduction,
      shouldPruneExpiredSessions: options.shouldPruneExpiredSessions ?? true,
    }),
  );

  app.use("/api", createRequireJsonBody({ uploadPaths: UPLOAD_PATHS }));
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
