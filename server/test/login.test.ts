import { describe, expect, it } from "vitest";
import request from "supertest";
import { DEFAULT_LOGIN_RATE_LIMIT } from "../src/auth/loginRateLimiter";
import {
  createTestApp,
  getSessionCookie,
  LOGIN_PATH,
  CURRENT_USER_PATH,
  postLogin,
  useTestPool,
} from "./support/testApp";

describe("POST /api/auth/login", () => {
  const pool = useTestPool();
  const app = createTestApp(pool);

  it("returns the user's public profile for valid credentials", async () => {
    const response = await postLogin(app, "alice");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: expect.any(String),
      username: "alice",
      displayName: "Alice",
    });
  });

  it("sets an HttpOnly, SameSite=Lax session cookie", async () => {
    const response = await postLogin(app, "alice");
    const setCookie = response.headers["set-cookie"][0];

    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).not.toContain("Secure");
  });

  it("marks the cookie Secure in production behind an HTTPS proxy", async () => {
    const productionApp = createTestApp(pool, { isProduction: true });

    const response = await request(productionApp)
      .post(LOGIN_PATH)
      .set("X-Forwarded-Proto", "https")
      .send({ username: "alice", password: "test-password-123" });
    const setCookie = response.headers["set-cookie"][0];

    expect(response.status).toBe(200);
    expect(setCookie).toContain("Secure");
  });

  it("treats the username as case-insensitive", async () => {
    const response = await postLogin(app, "  Alice ");

    expect(response.status).toBe(200);
    expect(response.body.username).toBe("alice");
  });

  it("rejects a wrong password with a generic 401", async () => {
    const response = await postLogin(app, "alice", "wrong-password");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Invalid username or password" });
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("gives an unknown user exactly the same response as a wrong password", async () => {
    const wrongPassword = await postLogin(app, "alice", "wrong-password");
    const unknownUser = await postLogin(app, "mallory", "wrong-password");

    expect(unknownUser.status).toBe(wrongPassword.status);
    expect(unknownUser.body).toEqual(wrongPassword.body);
  });

  it.each([
    ["missing password", { username: "alice" }],
    ["missing username", { password: "x" }],
    ["empty strings", { username: "", password: "" }],
    ["wrong types", { username: 42, password: ["x"] }],
  ])("returns 400 for %s", async (_label, body) => {
    const response = await request(app).post(LOGIN_PATH).send(body);

    expect(response.status).toBe(400);
  });

  it("returns 415 for a body that isn't JSON", async () => {
    const response = await request(app)
      .post(LOGIN_PATH)
      .type("form")
      .send("username=alice&password=test-password-123");

    expect(response.status).toBe(415);
  });

  it("issues a new session id on login and invalidates the old one", async () => {
    const firstResponse = await postLogin(app, "alice");
    const firstCookie = getSessionCookie(firstResponse.headers["set-cookie"]);

    const secondResponse = await request(app)
      .post(LOGIN_PATH)
      .set("Cookie", firstCookie)
      .send({ username: "alice", password: "test-password-123" });
    const secondCookie = getSessionCookie(secondResponse.headers["set-cookie"]);
    const oldCookieResponse = await request(app)
      .get(CURRENT_USER_PATH)
      .set("Cookie", firstCookie);

    expect(secondCookie).not.toBe(firstCookie);
    expect(oldCookieResponse.status).toBe(401);
  });
});

describe("login rate limiting", () => {
  const pool = useTestPool();
  const MAX_ATTEMPTS = DEFAULT_LOGIN_RATE_LIMIT.maxAttempts;

  it("doesn't count successful logins toward the limit", async () => {
    const app = createTestApp(pool, {
      loginRateLimit: DEFAULT_LOGIN_RATE_LIMIT,
    });

    for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
      await postLogin(app, "alice");
    }
    const response = await postLogin(app, "alice");

    expect(response.status).toBe(200);
  });

  it("returns 429 on the 11th failed attempt within a minute", async () => {
    const app = createTestApp(pool, {
      loginRateLimit: DEFAULT_LOGIN_RATE_LIMIT,
    });
    const statuses: number[] = [];

    for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
      const response = await postLogin(app, "alice", "wrong-password");
      statuses.push(response.status);
    }

    const allowedStatuses = statuses.slice(0, MAX_ATTEMPTS);
    expect(allowedStatuses.every((status) => status === 401)).toBe(true);
    expect(statuses[MAX_ATTEMPTS]).toBe(429);
  });
});
