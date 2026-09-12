import { STAGES, stageIndex } from "@/lib/stages";
import type { ActuarialData, Grounding, MatchedProduct, NewsItem, Receipt, RunEvent, RunRecord, Stage } from "@/lib/types";

export type RunState = {
  runId: string | null;
  status: "idle" | "running" | "done" | "error";
  startedAt: number | null;
  stageIndex: number;
  timings: Partial<Record<Stage, number>>;
  news: NewsItem[];
  selected: NewsItem | null;
  matches: MatchedProduct[];
  actuarial: ActuarialData | null;
  debate: { pm?: string; underwriter?: string; actuary?: string };
  grounding: Grounding | null;
  reportPath: string | null;
  chainPending: boolean;
  receipt: Receipt | null;
  record: RunRecord | null;
  error: string | null;
};

export function initialRunState(): RunState {
  return {
    runId: null,
    status: "idle",
    startedAt: null,
    stageIndex: -1,
    timings: {},
    news: [],
    selected: null,
    matches: [],
    actuarial: null,
    debate: {},
    grounding: null,
    reportPath: null,
    chainPending: false,
    receipt: null,
    record: null,
    error: null,
  };
}

export function startRunState(runId: string, atMs: number): RunState {
  return { ...initialRunState(), runId, status: "running", startedAt: atMs };
}

function elapsed(state: RunState, atMs: number): number {
  const start = state.startedAt ?? atMs;
  return Math.round(((atMs - start) / 1000) * 10) / 10;
}

/** Pure and idempotent: re-applying an event (polling fallback) never duplicates or re-times it. */
export function applyEvent(state: RunState, event: RunEvent, atMs: number): RunState {
  const { stage, data } = event;
  const next: RunState = { ...state, debate: { ...state.debate }, timings: { ...state.timings } };

  if (next.timings[stage] === undefined) next.timings[stage] = elapsed(state, atMs);
  const idx = stageIndex(stage);
  if (idx > next.stageIndex) next.stageIndex = idx;

  switch (stage) {
    case "news_fetched":
      next.news = Array.isArray(data) ? (data as NewsItem[]) : [];
      break;
    case "news_selected":
      next.selected = data as NewsItem;
      break;
    case "kb_matched":
      next.matches = Array.isArray(data) ? (data as MatchedProduct[]) : [];
      break;
    case "actuarial":
      next.actuarial = data as ActuarialData;
      break;
    case "pm":
      next.debate.pm = String(data ?? "");
      break;
    case "underwriter":
      next.debate.underwriter = String(data ?? "");
      break;
    case "actuary":
      next.debate.actuary = String(data ?? "");
      break;
    case "grounding":
      next.grounding = data as Grounding;
      break;
    case "report":
      next.reportPath = (data as { report_path?: string } | null)?.report_path ?? null;
      break;
    case "chain_pending":
      next.chainPending = true;
      break;
    case "chain_done":
      next.chainPending = false;
      next.receipt = data as Receipt;
      break;
    case "done":
      next.record = data as RunRecord;
      next.status = "done";
      next.stageIndex = STAGES.length - 1;
      break;
    case "error":
      next.status = "error";
      next.error = String(data ?? "unknown error");
      break;
  }
  return next;
}
