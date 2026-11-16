import { Router } from "express";
import type { DbPool } from "../db/pool";
import { listPublicUsers } from "../db/userQueries";
import { requireAuth } from "../auth/requireAuth";

/** Routes under /api/users. Lists everyone, for the share picker. */
export function createUserRouter(pool: DbPool): Router {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (_request, response) => {
    response.json(await listPublicUsers(pool));
  });

  return router;
}
