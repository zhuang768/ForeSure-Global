import type { DictKey } from "@/lib/i18n";
import type { GroundingFlag, GroundingStatus } from "@/lib/types";

export type GroundingTone = "none" | GroundingStatus;

/** Verdict → badge tone. Anything missing or unknown (legacy records) renders nothing. */
export function groundingTone(status: GroundingStatus | string | null | undefined): GroundingTone {
  return status === "pass" || status === "warn" || status === "fail" ? status : "none";
}

export function flagTypeKey(type: GroundingFlag["type"]): DictKey {
  return `grounding.flag.${type}` as DictKey;
}
