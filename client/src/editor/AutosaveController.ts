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
  private inFlightChanges: PendingChanges | null = null;
  private status: SaveStatus = "saved";
  private version: number;
  private isClosed = false;
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
    return this.hasUnsavedChanges() || this.inFlightChanges !== null;
  }

  /** True when there are edits that leaving now would most likely lose. */
  hasChangesAtRisk(): boolean {
    return (
      this.hasUnsavedChanges() &&
      (this.status === "offline" || this.isStopped())
    );
  }

  /**
   * Everything not yet confirmed saved, for one last request as the tab closes.
   * Includes a save still in progress, so this request is complete on its own.
   */
  readFinalSaveRequest(): UpdateDocumentRequest {
    return {
      version: this.version,
      ...this.inFlightChanges,
      ...this.pendingChanges,
    };
  }

  onStatusChange(listener: (status: SaveStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Records an edit and schedules a save. Ignored once saving has stopped for good. */
  recordChange(changes: PendingChanges): void {
    if (this.isClosed || this.isStopped()) {
      return;
    }

    this.pendingChanges = { ...this.pendingChanges, ...changes };

    // While offline, the retry timer owns the next attempt.
    if (this.status === "offline") {
      return;
    }

    this.setStatus(this.inFlightChanges ? "saving" : "unsaved");
    this.restartDebounceTimer();
    this.maxWaitTimer ??= setTimeout(
      () => void this.saveNow(),
      this.timing.maxWaitMs,
    );
  }

  /** Saves pending changes immediately (used for title Enter/blur). */
  async saveNow(): Promise<void> {
    this.clearTimers();

    if (!this.isClosed && this.canSendNow()) {
      await this.sendPendingChanges();
    }
  }

  /** Marks the editor as open. Called again when React StrictMode re-runs effects. */
  open(): void {
    this.isClosed = false;
  }

  /**
   * The editor closed (e.g. "← Documents"): stops timers and sends unsaved edits
   * once, without retrying, so leaving inside the app doesn't drop them.
   */
  close(): void {
    this.isClosed = true;
    this.clearTimers();

    if (this.canSendNow()) {
      void this.sendPendingChanges();
    }
  }

  private canSendNow(): boolean {
    return (
      this.hasUnsavedChanges() &&
      this.inFlightChanges === null &&
      !this.isStopped()
    );
  }

  private async sendPendingChanges(): Promise<void> {
    const changes = this.pendingChanges;
    const request = { version: this.version, ...changes };
    this.inFlightChanges = changes;
    this.pendingChanges = {};
    this.setStatus("saving");

    try {
      const saved = await this.save(request);
      this.handleSaveSucceeded(saved);
    } catch (error) {
      this.handleSaveFailed(error);
    } finally {
      this.inFlightChanges = null;
    }

    this.scheduleFollowUpSave();
  }

  private handleSaveSucceeded(saved: DocumentDetails): void {
    this.version = saved.version;
    this.retryAttempt = 0;
    this.setStatus(this.hasUnsavedChanges() ? "unsaved" : "saved");
  }

  private handleSaveFailed(error: unknown): void {
    const httpStatus = error instanceof ApiError ? error.status : undefined;
    const permanentStatus = httpStatus
      ? PERMANENT_FAILURE_BY_HTTP_STATUS[httpStatus]
      : undefined;

    // Put the unsent edits back, keeping anything typed while the request was out.
    this.pendingChanges = { ...this.inFlightChanges, ...this.pendingChanges };
    this.setStatus(permanentStatus ?? "offline");
  }

  /** After a request finishes: retry if offline, or save edits made while it was in flight. */
  private scheduleFollowUpSave(): void {
    if (this.isClosed) {
      // Once closed, only edits made during the last request are sent, and never retried.
      if (this.status === "unsaved") {
        void this.sendPendingChanges();
      }
      return;
    }

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
