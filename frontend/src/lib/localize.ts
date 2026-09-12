import type { Lang } from "@/lib/i18n";
import type { ActuarialBasis, Proposal } from "@/lib/types";

export type ProposalField =
  | "product_name"
  | "target_audience"
  | "market_gap"
  | "coverage_details"
  | "exclusions"
  | "business_logic";

function nonEmpty(s: string | undefined | null): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

/**
 * Proposal text in the UI language. The agent writes every field twice (zh + `_en`, docs/API.md);
 * records made before 2026-09-05 13:00 have no `_en`, so English falls back to the Chinese original.
 */
export function localizedField(proposal: Proposal | null | undefined, field: ProposalField, lang: Lang): string {
  if (!proposal) return "";
  if (lang === "en") {
    const en = proposal[`${field}_en`];
    if (nonEmpty(en)) return en;
  }
  return proposal[field] ?? "";
}

/** Data-source name for the probability figure; "assumption" is a sentinel and never translated here. */
export function localizedSource(basis: ActuarialBasis | null | undefined, lang: Lang): string | undefined {
  if (!basis) return undefined;
  const zh = basis.probability_source;
  if (zh === "assumption") return zh;
  if (lang === "en" && nonEmpty(basis.probability_source_en)) return basis.probability_source_en;
  return zh;
}
