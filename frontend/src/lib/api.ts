import { STAGES } from "@/lib/stages";
import type {
  ActiveRun,
  ChainStatus,
  Health,
  RedTeamReport,
  RunEvent,
  RunRecord,
  RunSummary,
  Stage,
  VerifyResult,
} from "@/lib/types";
import { MOCK_RUN_RECORDS, MOCK_RUN_SUMMARIES } from "@/lib/mockData";
// Offline demo falls back to the committed snapshot; tests/test_redteam.py keeps it identical to a live run.
import redteamSnapshot from "@/lib/redteamReport.json";

const MOCK_REDTEAM_REPORT = redteamSnapshot as RedTeamReport;

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080").replace(/\/$/, "");
// Demo token; intentionally public and accepted by the backend for the hackathon only.
const TOKEN = process.env.NEXT_PUBLIC_API_TOKEN ?? "MOCK_APIGEE_TOKEN";

// ── offline detection ─────────────────────────────────────────────────────────

let _offlineMode: boolean | null = null;

async function checkOnline(): Promise<boolean> {
  if (_offlineMode !== null) return !_offlineMode;
  // In browser, if current page is HTTPS and API_BASE is HTTP (like default localhost),
  // Mixed Content is blocked immediately by browsers. Avoid blocking or hanging fetch.
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    API_BASE.startsWith("http://")
  ) {
    _offlineMode = true;
    return false;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${API_BASE}/api/v1/health`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timer);
    _offlineMode = !res.ok;
    return res.ok;
  } catch {
    _offlineMode = true;
    return false;
  }
}

// ── core request ──────────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* not json */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

const auth = { Authorization: `Bearer ${TOKEN}` };

// ── public API (with offline fallback) ───────────────────────────────────────

export async function health(): Promise<Health> {
  try {
    return await request<Health>("/api/v1/health");
  } catch {
    _offlineMode = true;
    return { status: "demo", timestamp: Date.now() / 1000, chain: "mock" };
  }
}

/** null means no backend answered; the header then says "offline" instead of pretending a chain mode. */
export async function chainStatus(): Promise<ChainStatus | null> {
  try {
    const online = await checkOnline();
    if (!online) return null;
    return await request<ChainStatus>("/api/v1/chain/status");
  } catch {
    _offlineMode = true;
    return null;
  }
}

export async function redTeamReport(): Promise<RedTeamReport> {
  try {
    const online = await checkOnline();
    if (!online) return MOCK_REDTEAM_REPORT;
    return await request<RedTeamReport>("/api/v1/redteam");
  } catch {
    _offlineMode = true;
    return MOCK_REDTEAM_REPORT;
  }
}

const LOCAL_STORAGE_KEY = "atlas.local_runs";

export function getLocalStoredRuns(): { summaries: RunSummary[]; records: RunRecord[] } {
  if (typeof window === "undefined") return { summaries: [], records: [] };
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return { summaries: [], records: [] };
    return JSON.parse(raw);
  } catch {
    return { summaries: [], records: [] };
  }
}

export function saveLocalRun(record: RunRecord) {
  if (typeof window === "undefined") return;
  try {
    const { summaries, records } = getLocalStoredRuns();
    const summary: RunSummary = {
      decision_id: record.decision_id,
      run_id: record.run_id ?? null,
      timestamp: record.timestamp,
      news_title: record.news.title,
      product_name: record.proposal_data.proposal.product_name,
      is_mock_proposal: record.proposal_data.is_mock ?? false,
      chain_is_mock: record.blockchain_receipt.is_mock || !record.blockchain_receipt.blockchain_tx_hash,
      tx_hash: record.blockchain_receipt.blockchain_tx_hash,
      verification_url: record.blockchain_receipt.verification_url,
      grounding_status: record.grounding?.status ?? null,
    };
    const nextSummaries = [summary, ...summaries.filter((s) => s.decision_id !== record.decision_id)];
    const nextRecords = [record, ...records.filter((r) => r.decision_id !== record.decision_id)];
    window.localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({ summaries: nextSummaries.slice(0, 30), records: nextRecords.slice(0, 30) }),
    );
  } catch {
    /* ignore storage quota errors */
  }
}

export async function listRuns(limit = 50): Promise<RunSummary[]> {
  try {
    const online = await checkOnline();
    if (!online) {
      const { summaries } = getLocalStoredRuns();
      return [...summaries, ...MOCK_RUN_SUMMARIES].slice(0, limit);
    }
    return await request<RunSummary[]>(`/api/v1/runs?limit=${limit}`);
  } catch {
    _offlineMode = true;
    const { summaries } = getLocalStoredRuns();
    return [...summaries, ...MOCK_RUN_SUMMARIES].slice(0, limit);
  }
}

export async function getRun(id: string): Promise<RunRecord> {
  try {
    const online = await checkOnline();
    if (!online) {
      const { records } = getLocalStoredRuns();
      const local = records.find((r) => r.decision_id === id);
      if (local) return local;
      const rec = MOCK_RUN_RECORDS.find((r) => r.decision_id === id) ?? MOCK_RUN_RECORDS[0];
      return rec;
    }
    return await request<RunRecord>(`/api/v1/runs/${encodeURIComponent(id)}`);
  } catch {
    const { records } = getLocalStoredRuns();
    const local = records.find((r) => r.decision_id === id);
    if (local) return local;
    const rec = MOCK_RUN_RECORDS.find((r) => r.decision_id === id) ?? MOCK_RUN_RECORDS[0];
    return rec;
  }
}

export async function getActiveRun(runId: string): Promise<ActiveRun> {
  return await request<ActiveRun>(`/api/v1/runs/${encodeURIComponent(runId)}`);
}

export async function startRun(): Promise<{ run_id: string; status: string }> {
  const online = await checkOnline();
  if (!online) {
    // Return a mock run ID to trigger the local mock simulation
    return { run_id: "demo-run-" + Date.now(), status: "running" };
  }
  return request<{ run_id: string; status: string }>("/api/v1/runs", {
    method: "POST",
    headers: auth,
  });
}

/** Shown with an offline verification: the panel must not present a simulated result as a chain check. */
export const OFFLINE_VERIFY_REASON = "離線模擬結果，未與鏈上紀錄比對 / offline simulation, not checked against the chain";

export async function verifyRun(id: string, tampered?: Record<string, unknown>): Promise<VerifyResult> {
  const online = await checkOnline();
  if (!online) {
    // No backend: simulate honestly. A tampered payload never "matches", and the result says it is simulated.
    const rec = MOCK_RUN_RECORDS.find((r) => r.decision_id === id) ?? MOCK_RUN_RECORDS[0];
    const tamperedFields = Object.keys(tampered ?? {}).sort();
    return {
      decision_id: id,
      matched: tamperedFields.length === 0,
      is_mock: true,
      reason: OFFLINE_VERIFY_REASON,
      tampered_fields: tamperedFields,
      payload: { ...rec.blockchain_receipt.payload, ...(tampered ?? {}) },
      stored_hash: rec.blockchain_receipt.data_hash,
      tx_hash: rec.blockchain_receipt.blockchain_tx_hash,
      verification_url: rec.blockchain_receipt.verification_url,
      onchain_timestamp: null,
      submitter: null,
    };
  }
  // Backend reachable: a failed request is an error the caller shows; never fabricate a match.
  return request<VerifyResult>(`/api/v1/runs/${encodeURIComponent(id)}/verify`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify(tampered ? { tampered } : {}),
  });
}

const ALL_STAGES: readonly string[] = [...STAGES, "error"];

/**
 * Subscribe to the SSE stream. Returns a cleanup function.
 * onError fires once if the browser reports a connection error before done/error arrived;
 * the caller decides whether to fall back to polling.
 */
export function openRunStream(runId: string, onEvent: (event: RunEvent) => void, onError: () => void): () => void {
  // Demo run IDs never have a real SSE stream — go straight to mock simulation
  if (runId.startsWith("demo-run-")) {
    onError(); // signals the caller to use the mock event playback
    return () => {};
  }

  const es = new EventSource(`${API_BASE}/api/v1/runs/${encodeURIComponent(runId)}/events`);
  let finished = false;
  for (const stage of ALL_STAGES) {
    es.addEventListener(stage, (e) => {
      // A dropped connection is also dispatched as an "error" Event; only a server-sent message carries
      // string data. Without this guard the transport error was reported as the pipeline's error stage
      // and es.onerror never reached the polling fallback.
      if (typeof (e as MessageEvent).data !== "string") return;
      const raw = (e as MessageEvent).data as string;
      let data: unknown = raw;
      try {
        data = JSON.parse(raw);
      } catch {
        /* keep raw string */
      }
      if (stage === "done" || stage === "error") finished = true;
      onEvent({ stage: stage as Stage, data });
      if (finished) es.close();
    });
  }
  es.onerror = () => {
    if (!finished) {
      es.close();
      onError();
    }
  };
  return () => es.close();
}
