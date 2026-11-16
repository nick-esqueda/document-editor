import { describe, expect, it } from "vitest";
import { assertSafeToWipe } from "./support/testDatabase";

const APP_URL = "postgres://user:pw@localhost:5432/doc_editor";
const TEST_URL = "postgres://user:pw@localhost:5432/doc_editor_test";

describe("test database guard", () => {
  it("accepts a separate database whose name ends in _test", () => {
    expect(() => assertSafeToWipe(TEST_URL, APP_URL)).not.toThrow();
  });

  it("refuses to wipe the app database", () => {
    expect(() => assertSafeToWipe(APP_URL, APP_URL)).toThrow(
      /same as DATABASE_URL/,
    );
  });

  it("refuses a database whose name doesn't end in _test", () => {
    const otherUrl = "postgres://user:pw@localhost:5432/production";

    expect(() => assertSafeToWipe(otherUrl, APP_URL)).toThrow(
      /must end in "_test"/,
    );
  });
});
