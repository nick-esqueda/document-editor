const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Ordered from most recent to oldest: the first rule whose age limit the edit
 * falls under produces the label. To add a bucket, insert a rule in order.
 */
const EDITED_TIME_RULES: Array<{
  maxAgeMs: number;
  describe: (ageMs: number, editedAt: Date) => string;
}> = [
  { maxAgeMs: MINUTE_MS, describe: () => "Edited just now" },
  {
    maxAgeMs: HOUR_MS,
    describe: (ageMs) => `Edited ${Math.floor(ageMs / MINUTE_MS)} min ago`,
  },
  {
    maxAgeMs: DAY_MS,
    describe: (ageMs) => `Edited ${Math.floor(ageMs / HOUR_MS)} hr ago`,
  },
  { maxAgeMs: 2 * DAY_MS, describe: () => "Edited yesterday" },
];

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

/** Turns an ISO timestamp into "Edited 2 min ago", "Edited yesterday", "Edited Nov 10", … */
export function formatEditedTime(
  updatedAt: string,
  now: Date = new Date(),
): string {
  const editedAt = new Date(updatedAt);
  const ageMs = Math.max(0, now.getTime() - editedAt.getTime());
  const matchingRule = EDITED_TIME_RULES.find((rule) => ageMs < rule.maxAgeMs);

  return matchingRule
    ? matchingRule.describe(ageMs, editedAt)
    : `Edited ${DATE_FORMAT.format(editedAt)}`;
}
