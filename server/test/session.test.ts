import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  createTestApp,
  CURRENT_USER_PATH,
  LOGOUT_PATH,
  logInAndGetCookie,
  postLogin,
  useTestPool,
} from "./support/testApp";

describe("GET /api/auth/me", () => {
  const pool = useTestPool();
  const app = createTestApp(pool);

  it("returns the logged-in user", async () => {
    const cookie = await logInAndGetCookie(app, "bob");

    const response = await request(app)
      .get(CURRENT_USER_PATH)
      .set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      username: "bob",
      displayName: "Bob",
    });
  });

  it("returns 401 without a cookie", async () => {
    const response = await request(app).get(CURRENT_USER_PATH);

    expect(response.status).toBe(401);
  });

  it("returns 401 when the cookie signature is tampered with", async () => {
    const cookie = await logInAndGetCookie(app, "bob");
    const lastCharacter = cookie.at(-1);
    const tamperedCookie =
      cookie.slice(0, -1) + (lastCharacter === "A" ? "B" : "A");

    const response = await request(app)
      .get(CURRENT_USER_PATH)
      .set("Cookie", tamperedCookie);

    expect(response.status).toBe(401);
  });

  it("never includes the password hash in auth responses", async () => {
    const loginResponse = await postLogin(app, "bob");
    const cookie = await logInAndGetCookie(app, "bob");
    const meResponse = await request(app)
      .get(CURRENT_USER_PATH)
      .set("Cookie", cookie);

    const responseTexts = [loginResponse.text, meResponse.text];
    for (const text of responseTexts) {
      expect(text).not.toMatch(/password|\$2[aby]\$/i);
    }
  });
});

describe("POST /api/auth/logout", () => {
  const pool = useTestPool();
  const app = createTestApp(pool);

  it("ends the session so the same cookie no longer works", async () => {
    const cookie = await logInAndGetCookie(app, "carol");

    const logoutResponse = await request(app)
      .post(LOGOUT_PATH)
      .set("Cookie", cookie);
    const meResponse = await request(app)
      .get(CURRENT_USER_PATH)
      .set("Cookie", cookie);

    expect(logoutResponse.status).toBe(204);
    expect(meResponse.status).toBe(401);
  });

  it("returns 204 even when there is no session", async () => {
    const response = await request(app).post(LOGOUT_PATH);

    expect(response.status).toBe(204);
  });
});
