import type {
  DocumentDetails,
  DocumentJson,
  UpdateDocumentRequest,
} from "@doc-editor/shared";
import { ApiError } from "../api/httpClient";

export type SaveStatus =
  | "saved"
  | "unsaved"
  | "saving"
  | "offline"
  | "conflict"
  | "accessLost"
  | "failed";

export interface PendingChanges {
  title?: string;
  content?: DocumentJson;
}

export interface AutosaveTiming {
  /** Wait this long after the last edit before saving. */
  debounceMs: number;
  /** During continuous editing, save at least this often. */
  maxWaitMs: number;
  /** Waits between retries after a failed save; the last value repeats. */
  retryDelaysMs: number[];
}

export const DEFAULT_AUTOSAVE_TIMING: AutosaveTiming = {
  debounceMs: 1000,
  maxWaitMs: 5000,
  retryDelaysMs: [1000, 2000, 4000, 8000, 15000],
};

export type SaveRequest = (
  changes: UpdateDocumentRequest,
) => Promise<DocumentDetails>;

/** Statuses that stop autosave for good, by HTTP status of the failed save. */
const PERMANENT_FAILURE_BY_HTTP_STATUS: Record<number, SaveStatus> = {
  409: "conflict",
  404: "accessLost",
  403: "accessLost",
  400: "failed",
  413: "failed",
};

/**
 * Decides when to save. It only ever saves after an edit: once 1 s after the
 * last change, at most every 5 s during continuous editing, and never while idle.
 * Failed saves retry with growing waits; conflicts and lost access stop saving.
 * React-free so the timing can be tested exactly. `useAutosave` wraps it for components.
 */
export class AutosaveController {
  private pendingChanges: PendingChanges = {};
  private status: SaveStatus = "saved";
  private version: number;
  private isRequestInFlight = false;
  private retryAttempt = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly statusListeners = new Set<(status: SaveStatus) => void>();

  constructor(
    initialVersion: number,
    private readonly save: SaveRequest,
    private readonly timing: AutosaveTiming = DEFAULT_AUTOSAVE_TIMING,
  ) {
    this.version = initialVersion;
  }

  getStatus(): SaveStatus {
    return this.status;
  }

  hasUnsavedChanges(): boolean {
    return Object.keys(this.pendingChanges).length > 0;
  }

  /** True while there's anything not yet confirmed saved, including a save in progress. */
  hasUnsavedWork(): boolean {
    return this.hasUnsavedChanges() || this.isRequestInFlight;
  }

  /** Returns what still needs saving, with the version it's based on. */
  readPendingRequest(): UpdateDocumentRequest {
    return { version: this.version, ...this.pendingChanges };
  }

  onStatusChange(listener: (status: SaveStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Records an edit and schedules a save. Ignored once saving has stopped for good. */
  recordChange(changes: PendingChanges): void {
    if (this.isStopped()) {
      return;
    }

    this.pendingChanges = { ...this.pendingChanges, ...changes };

    // While offline, the retry timer owns the next attempt.
    if (this.status === "offline") {
      return;
    }

    this.setStatus(this.isRequestInFlight ? "saving" : "unsaved");
    this.restartDebounceTimer();
    this.maxWaitTimer ??= setTimeout(
      () => void this.saveNow(),
      this.timing.maxWaitMs,
    );
  }

  /** Saves pending changes immediately (used for title Enter/blur). */
  async saveNow(): Promise<void> {
    this.clearTimers();

    if (
      !this.hasUnsavedChanges() ||
      this.isRequestInFlight ||
      this.isStopped()
    ) {
      return;
    }

    const request = this.readPendingRequest();
    this.pendingChanges = {};
    this.isRequestInFlight = true;
    this.setStatus("saving");

    try {
      const saved = await this.save(request);
      this.handleSaveSucceeded(saved);
    } catch (error) {
      this.handleSaveFailed(request, error);
    } finally {
      this.isRequestInFlight = false;
    }

    this.scheduleFollowUpSave();
  }

  /** Stops all timers, e.g. when the editor unmounts. */
  dispose(): void {
    this.clearTimers();
    this.statusListeners.clear();
  }

  private handleSaveSucceeded(saved: DocumentDetails): void {
    this.version = saved.version;
    this.retryAttempt = 0;
    this.setStatus(this.hasUnsavedChanges() ? "unsaved" : "saved");
  }

  private handleSaveFailed(
    failedRequest: UpdateDocumentRequest,
    error: unknown,
  ): void {
    const httpStatus = error instanceof ApiError ? error.status : undefined;
    const permanentStatus = httpStatus
      ? PERMANENT_FAILURE_BY_HTTP_STATUS[httpStatus]
      : undefined;

    // Put the unsent edits back, keeping anything typed while the request was out.
    const { version, ...failedChanges } = failedRequest;
    this.pendingChanges = { ...failedChanges, ...this.pendingChanges };
    this.setStatus(permanentStatus ?? "offline");
  }

  /** After a request finishes: retry if offline, or save edits made while it was in flight. */
  private scheduleFollowUpSave(): void {
    if (this.status === "offline") {
      this.scheduleRetry();
      return;
    }

    if (this.status === "unsaved") {
      this.restartDebounceTimer();
    }
  }

  private scheduleRetry(): void {
    const delays = this.timing.retryDelaysMs;
    const delayIndex = Math.min(this.retryAttempt, delays.length - 1);
    this.retryAttempt += 1;
    this.retryTimer = setTimeout(() => void this.saveNow(), delays[delayIndex]);
  }

  private restartDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(
      () => void this.saveNow(),
      this.timing.debounceMs,
    );
  }

  private clearTimers(): void {
    const timers = [this.debounceTimer, this.maxWaitTimer, this.retryTimer];
    timers.forEach((timer) => timer && clearTimeout(timer));

    this.debounceTimer = null;
    this.maxWaitTimer = null;
    this.retryTimer = null;
  }

  private isStopped(): boolean {
    const stoppedStatuses: SaveStatus[] = ["conflict", "accessLost", "failed"];
    return stoppedStatuses.includes(this.status);
  }

  private setStatus(status: SaveStatus): void {
    if (status === this.status) {
      return;
    }

    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }
}
