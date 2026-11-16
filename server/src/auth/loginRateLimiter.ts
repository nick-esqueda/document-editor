import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";

export interface LoginRateLimit {
  windowMs: number;
  maxAttempts: number;
}

export const DEFAULT_LOGIN_RATE_LIMIT: LoginRateLimit = {
  windowMs: 60 * 1000,
  maxAttempts: 10,
};

/**
 * Limits failed login attempts per client IP to slow down password guessing.
 * Successful logins don't count, so normal use never hits the limit.
 */
export function createLoginRateLimiter(limit: LoginRateLimit): RequestHandler {
  return rateLimit({
    windowMs: limit.windowMs,
    limit: limit.maxAttempts,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
      error: "Too many failed login attempts. Try again in a minute.",
    },
  });
}
