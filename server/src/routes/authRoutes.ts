import {
  Router,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import { z } from "zod";
import type { DbPool } from "../db/pool";
import {
  findPublicUserById,
  findUserWithPasswordHash,
  toPublicUser,
  type UserWithPasswordHash,
} from "../db/userQueries";
import { isPasswordCorrect } from "../auth/passwords";
import { requireAuth } from "../auth/requireAuth";
import { SESSION_COOKIE_NAME } from "../auth/sessionMiddleware";
import { sendError } from "../http/sendError";

const MAX_CREDENTIAL_LENGTH = 200;
const INVALID_CREDENTIALS_MESSAGE = "Invalid username or password";

const loginBodySchema = z.object({
  username: z.string().min(1).max(MAX_CREDENTIAL_LENGTH),
  password: z.string().min(1).max(MAX_CREDENTIAL_LENGTH),
});

export interface AuthRouterOptions {
  pool: DbPool;
  loginRateLimiter: RequestHandler;
}

/** Routes under /api/auth: login, logout and "who am I". */
export function createAuthRouter(options: AuthRouterOptions): Router {
  const router = Router();

  router.post("/login", options.loginRateLimiter, (request, response) =>
    handleLogin(options.pool, request, response),
  );
  router.post("/logout", handleLogout);
  router.get("/me", requireAuth, (request, response) =>
    handleGetCurrentUser(options.pool, request, response),
  );

  return router;
}

async function handleLogin(
  pool: DbPool,
  request: Request,
  response: Response,
): Promise<void> {
  const parsedBody = loginBodySchema.safeParse(request.body);

  if (!parsedBody.success) {
    sendError(response, 400, "Username and password are required");
    return;
  }

  const { username, password } = parsedBody.data;
  const user = await findUserWithValidPassword(pool, username, password);

  if (!user) {
    sendError(response, 401, INVALID_CREDENTIALS_MESSAGE);
    return;
  }

  await startNewSession(request, user.id);
  response.json(toPublicUser(user));
}

/** Returns the user only when the username exists and the password matches. */
async function findUserWithValidPassword(
  pool: DbPool,
  username: string,
  password: string,
): Promise<UserWithPasswordHash | null> {
  const user = await findUserWithPasswordHash(pool, username);

  if (!user) {
    return null;
  }

  const isCorrect = await isPasswordCorrect(password, user.passwordHash);
  return isCorrect ? user : null;
}

/** Issues a fresh session id at login so an old (possibly planted) id can't be reused. */
function startNewSession(request: Request, userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.regenerate((regenerateError) => {
      if (regenerateError) {
        reject(regenerateError);
        return;
      }

      request.session.userId = userId;
      request.session.save((saveError) =>
        saveError ? reject(saveError) : resolve(),
      );
    });
  });
}

async function handleLogout(
  request: Request,
  response: Response,
): Promise<void> {
  await destroySession(request);
  response.clearCookie(SESSION_COOKIE_NAME);
  response.status(204).end();
}

function destroySession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.destroy((error) => (error ? reject(error) : resolve()));
  });
}

async function handleGetCurrentUser(
  pool: DbPool,
  request: Request,
  response: Response,
): Promise<void> {
  const userId = request.session.userId as string;
  const user = await findPublicUserById(pool, userId);

  if (!user) {
    sendError(response, 401, "Not logged in");
    return;
  }

  response.json(user);
}
