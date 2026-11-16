import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DocumentDetails,
  UpdateDocumentRequest,
} from "@doc-editor/shared";
import {
  AutosaveController,
  DEFAULT_AUTOSAVE_TIMING,
  type SaveStatus,
} from "../src/editor/AutosaveController";
import { ApiError } from "../src/api/httpClient";

const { debounceMs, maxWaitMs, retryDelaysMs } = DEFAULT_AUTOSAVE_TIMING;
const TYPING_INTERVAL_MS = 200;

function buildSavedDocument(version: number): DocumentDetails {
  return {
    id: "doc-1",
    title: "Doc",
    updatedAt: new Date().toISOString(),
    version,
    content: { type: "doc", content: [] },
  };
}

/** A fake save endpoint that bumps the version, like the real server. */
function createSucceedingSave() {
  return vi.fn(async (request: UpdateDocumentRequest) =>
    buildSavedDocument(request.version + 1),
  );
}

function typeCharacter(controller: AutosaveController, text: string) {
  controller.recordChange({
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    },
  });
}

function recordStatuses(controller: AutosaveController): SaveStatus[] {
  const statuses: SaveStatus[] = [];
  controller.onStatusChange((status) => statuses.push(status));
  return statuses;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("AutosaveController", () => {
  it("saves exactly once, 1 second after typing stops, then stays idle", async () => {
    const save = createSucceedingSave();
    const controller = new AutosaveController(1, save);

    typeCharacter(controller, "a");
    await vi.advanceTimersByTimeAsync(debounceMs - 1);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledOnce();
    expect(controller.getStatus()).toBe("saved");
  });

  it("saves at most once every 5 seconds during continuous typing", async () => {
    const save = createSucceedingSave();
    const controller = new AutosaveController(1, save);
    const typingDurationMs = 12_000;

    for (
      let elapsed = 0;
      elapsed < typingDurationMs;
      elapsed += TYPING_INTERVAL_MS
    ) {
      typeCharacter(controller, `text ${elapsed}`);
      await vi.advanceTimersByTimeAsync(TYPING_INTERVAL_MS);
    }

    expect(save).toHaveBeenCalledTimes(
      Math.floor(typingDurationMs / maxWaitMs),
    );
  });

  it("never saves when nothing was edited", async () => {
    const save = createSucceedingSave();
    new AutosaveController(1, save);

    await vi.advanceTimersByTimeAsync(60_000);

    expect(save).not.toHaveBeenCalled();
  });

  it("sends the latest version and moves through unsaved, saving and saved", async () => {
    const save = createSucceedingSave();
    const controller = new AutosaveController(1, save);
    const statuses = recordStatuses(controller);

    typeCharacter(controller, "first");
    await vi.advanceTimersByTimeAsync(debounceMs);
    typeCharacter(controller, "second");
    await vi.advanceTimersByTimeAsync(debounceMs);

    expect(save.mock.calls.map(([request]) => request.version)).toEqual([1, 2]);
    expect(statuses).toEqual([
      "unsaved",
      "saving",
      "saved",
      "unsaved",
      "saving",
      "saved",
    ]);
  });

  it("goes offline on a network failure, retries with growing waits, then recovers", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockImplementation(async (request: UpdateDocumentRequest) =>
        buildSavedDocument(request.version + 1),
      );
    const controller = new AutosaveController(1, save);

    typeCharacter(controller, "a");
    await vi.advanceTimersByTimeAsync(debounceMs);
    expect(controller.getStatus()).toBe("offline");

    await vi.advanceTimersByTimeAsync(retryDelaysMs[0]);
    expect(save).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(retryDelaysMs[1] - 1);
    expect(save).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(3);
    expect(controller.getStatus()).toBe("saved");
    expect(save.mock.calls[2][0].content).toEqual(
      save.mock.calls[0][0].content,
    );
  });

  it("keeps edits made while offline and saves them on the next retry", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockImplementation(async (request: UpdateDocumentRequest) =>
        buildSavedDocument(request.version + 1),
      );
    const controller = new AutosaveController(1, save);

    typeCharacter(controller, "before");
    await vi.advanceTimersByTimeAsync(debounceMs);
    typeCharacter(controller, "while offline");
    await vi.advanceTimersByTimeAsync(retryDelaysMs[0]);

    const retriedText =
      save.mock.calls[1][0].content?.content?.[0].content?.[0].text;
    expect(retriedText).toBe("while offline");
    expect(controller.getStatus()).toBe("saved");
  });

  it.each([
    [409, "conflict"],
    [404, "accessLost"],
    [400, "failed"],
  ] as const)(
    "stops saving after a %s and reports %s",
    async (httpStatus, expectedStatus) => {
      const save = vi.fn().mockRejectedValue(new ApiError(httpStatus, "nope"));
      const controller = new AutosaveController(1, save);

      typeCharacter(controller, "a");
      await vi.advanceTimersByTimeAsync(debounceMs);
      typeCharacter(controller, "b");
      await vi.advanceTimersByTimeAsync(60_000);

      expect(controller.getStatus()).toBe(expectedStatus);
      expect(save).toHaveBeenCalledOnce();
      expect(controller.hasUnsavedChanges()).toBe(true);
    },
  );

  it("saves immediately when asked, e.g. after a title change", async () => {
    const save = createSucceedingSave();
    const controller = new AutosaveController(3, save);

    controller.recordChange({ title: "New title" });
    await controller.saveNow();

    expect(save).toHaveBeenCalledWith({ version: 3, title: "New title" });
  });
});
