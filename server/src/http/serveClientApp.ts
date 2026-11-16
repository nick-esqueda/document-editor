import path from "node:path";
import express, { type Express, type Request } from "express";

const API_PATH_PREFIX = "/api";
const ENTRY_PAGE_FILE = "index.html";
const HASHED_ASSETS_DIR = "assets";
// Files under assets/ have a content hash in their name, so browsers can keep them for a year.
const HASHED_ASSET_MAX_AGE = "1y";
const OTHER_FILE_MAX_AGE = "1h";
// index.html must always be revalidated so users pick up the newest asset names after a deploy.
const ENTRY_PAGE_CACHE_CONTROL = "no-cache";

function isApiPath(requestPath: string): boolean {
  return (
    requestPath === API_PATH_PREFIX ||
    requestPath.startsWith(`${API_PATH_PREFIX}/`)
  );
}

/**
 * App routes like /d/123 have no file on disk, so they get index.html and React Router
 * takes over in the browser. Paths with a file extension (/assets/app.js) never do:
 * a missing file is a real 404, not an HTML page.
 */
function isAppRoute(request: Request): boolean {
  const isPageRequest = request.method === "GET" || request.method === "HEAD";
  const hasFileExtension = path.extname(request.path) !== "";
  return isPageRequest && !isApiPath(request.path) && !hasFileExtension;
}

/**
 * Serves the built React app (client/dist) from the API server, so production is one
 * service on one origin and the session cookie stays first-party. Register it before
 * the session middleware so static files don't touch the session store.
 */
export function serveClientApp(app: Express, clientDistDir: string): void {
  const hashedAssetsDir = path.join(clientDistDir, HASHED_ASSETS_DIR);
  const entryPagePath = path.join(clientDistDir, ENTRY_PAGE_FILE);

  app.use(
    `/${HASHED_ASSETS_DIR}`,
    express.static(hashedAssetsDir, {
      immutable: true,
      maxAge: HASHED_ASSET_MAX_AGE,
    }),
  );
  app.use(
    express.static(clientDistDir, { index: false, maxAge: OTHER_FILE_MAX_AGE }),
  );

  app.use((request, response, next) => {
    if (!isAppRoute(request)) {
      next();
      return;
    }
    response.setHeader("Cache-Control", ENTRY_PAGE_CACHE_CONTROL);
    response.sendFile(entryPagePath);
  });
}
