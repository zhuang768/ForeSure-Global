import type { Receipt, VerifyResult } from "@/lib/types";

export type BadgeState = "none" | "mock" | "pending" | "onchain" | "mismatch";

/** Spec §5: green only for a real, non-mock tx; "Verified" is never shown when in doubt. */
export function deriveBadgeState(input: {
  receipt?: Receipt | null;
  pending?: boolean;
  verify?: VerifyResult | null;
}): BadgeState {
  if (input.pending) return "pending";
  const r = input.receipt;
  if (!r) return "none";
  if (r.is_mock || !r.blockchain_tx_hash) return "mock";
  if (input.verify && input.verify.matched === false) return "mismatch";
  return "onchain";
}
