import type { DictKey } from "@/lib/i18n";
import type { RedTeamCase, RedTeamReport } from "@/lib/types";

export type RedTeamTone = "good" | "bad" | "muted";

/** Outcome → pill tone. A known gap is neither a pass nor a failure: it is a limitation we publish on purpose. */
export function outcomeTone(outcome: RedTeamCase["outcome"]): RedTeamTone {
  if (outcome === "detected" || outcome === "clean") return "good";
  if (outcome === "missed" || outcome === "false_positive") return "bad";
  return "muted";
}

export function outcomeKey(outcome: RedTeamCase["outcome"]): DictKey {
  return `redteam.outcome.${outcome}` as DictKey;
}

/** 0.9231 → "92.3%". Null (a suite with no cases of that kind) renders as an em dash. */
export function formatRate(rate: number | null | undefined): string {
  return rate === null || rate === undefined || Number.isNaN(rate) ? "—" : `${(rate * 100).toFixed(1)}%`;
}

/** The bench is only meaningful when nothing slipped through and nothing clean was flagged. */
export function isClean(report: Pick<RedTeamReport, "missed" | "false_positives">): boolean {
  return report.missed === 0 && report.false_positives === 0;
}
