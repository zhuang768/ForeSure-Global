import type { RunSummary } from "./types";

/** Circular index for carousels: wrapIndex(-1, 4) is 3, wrapIndex(4, 4) is 0. */
export function wrapIndex(i: number, n: number): number {
  if (n <= 0) return 0;
  return ((i % n) + n) % n;
}

/**
 * Which archived decisions earn a spot on the homepage "latest decisions" list.
 * Fallback (rule-based) proposals and nameless runs are skipped; anchored runs come before
 * runs still waiting for a transaction. The incoming order (newest first) is kept inside each group.
 */
export function pickShowcaseRuns(runs: RunSummary[], limit = 3): RunSummary[] {
  const eligible = runs.filter((r) => !r.is_mock_proposal && !!r.product_name);
  const anchored = eligible.filter((r) => !!r.tx_hash);
  const pending = eligible.filter((r) => !r.tx_hash);
  return [...anchored, ...pending].slice(0, limit);
}
