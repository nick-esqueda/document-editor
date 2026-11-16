import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requireAuth } from "../src/auth/requireAuth";

function buildResponseSpy() {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  return response;
}

function runRequireAuth(session: Record<string, unknown>) {
  const request = { session } as unknown as Request;
  const response = buildResponseSpy();
  const next = vi.fn() as NextFunction;

  requireAuth(request, response as unknown as Response, next);
  return { response, next };
}

describe("requireAuth", () => {
  it("passes a logged-in request through", () => {
    const { response, next } = runRequireAuth({ userId: "user-1" });

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });

  it("rejects a request without a logged-in user with 401", () => {
    const { response, next } = runRequireAuth({});

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(401);
  });
});
