import { describe, expect, it } from "vitest";
import { hashPassword, isPasswordCorrect } from "../src/auth/passwords";

describe("password hashing", () => {
  it("verifies the original password and rejects a different one", async () => {
    const passwordHash = await hashPassword("correct horse");

    expect(passwordHash).not.toContain("correct horse");
    await expect(
      isPasswordCorrect("correct horse", passwordHash),
    ).resolves.toBe(true);
    await expect(isPasswordCorrect("wrong horse", passwordHash)).resolves.toBe(
      false,
    );
  });
});
