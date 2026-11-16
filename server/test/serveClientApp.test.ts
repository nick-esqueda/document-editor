import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { serveClientApp } from "../src/http/serveClientApp";

const ENTRY_PAGE_HTML = "<!doctype html><title>Ajaia Doc Editor</title>";
const ASSET_SOURCE = "console.log('app');";
const API_RESPONSE = { ok: true };

/** Writes a tiny stand-in for client/dist into a temporary folder. */
function createFakeClientBuild(): string {
  const clientDistDir = mkdtempSync(path.join(tmpdir(), "client-dist-"));
  mkdirSync(path.join(clientDistDir, "assets"));
  writeFileSync(path.join(clientDistDir, "index.html"), ENTRY_PAGE_HTML);
  writeFileSync(
    path.join(clientDistDir, "assets", "app-abc123.js"),
    ASSET_SOURCE,
  );
  writeFileSync(path.join(clientDistDir, "favicon.svg"), "<svg/>");
  return clientDistDir;
}

function createAppWithClient(clientDistDir: string): express.Express {
  const app = express();
  serveClientApp(app, clientDistDir);
  app.get("/api/ping", (_request, response) => {
    response.json(API_RESPONSE);
  });
  return app;
}

describe("serveClientApp", () => {
  const clientDistDir = createFakeClientBuild();
  const app = createAppWithClient(clientDistDir);

  afterAll(() => {
    rmSync(clientDistDir, { recursive: true, force: true });
  });

  it.each(["/", "/login", "/d/123"])(
    "serves index.html, never cached, for the app route %s",
    async (appRoute) => {
      const response = await request(app).get(appRoute);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/text\/html/);
      expect(response.headers["cache-control"]).toBe("no-cache");
      expect(response.text).toBe(ENTRY_PAGE_HTML);
    },
  );

  it("never caches index.html requested by name", async () => {
    const response = await request(app).get("/index.html");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-cache");
    expect(response.text).toBe(ENTRY_PAGE_HTML);
  });

  it("serves hashed assets with a one-year immutable cache", async () => {
    const response = await request(app).get("/assets/app-abc123.js");

    expect(response.status).toBe(200);
    expect(response.text).toBe(ASSET_SOURCE);
    expect(response.headers["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("serves other files from the build folder", async () => {
    const response = await request(app).get("/favicon.svg");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=3600");
  });

  it("returns 404 instead of index.html for a missing file", async () => {
    const response = await request(app).get("/assets/missing.js");

    expect(response.status).toBe(404);
    expect(response.text).not.toContain(ENTRY_PAGE_HTML);
  });

  it("leaves /api requests to the API", async () => {
    const response = await request(app).get("/api/ping");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(API_RESPONSE);
  });

  it("does not answer an unknown /api path with index.html", async () => {
    const response = await request(app).get("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.text).not.toContain(ENTRY_PAGE_HTML);
  });
});
