import type { Stage } from "@/lib/types";

/** Backend emission order (see docs/API.md). `error` is not a progress stage. */
export const STAGES = [
  "news_fetched",
  "news_selected",
  "kb_matched",
  "actuarial",
  "pm",
  "underwriter",
  "actuary",
  "grounding",
  "report",
  "chain_pending",
  "chain_done",
  "done",
] as const satisfies readonly Stage[];

export type ProgressStage = (typeof STAGES)[number];

export function stageIndex(stage: Stage): number {
  return (STAGES as readonly string[]).indexOf(stage);
}
