import { afterEach, describe, expect, it, vi } from "vitest";

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error",
    json: async () => body,
  } as unknown as Response;
}

/** Fresh module per test: api.ts caches the online/offline probe in module state. */
async function loadApi(fetchImpl: FetchImpl) {
  vi.resetModules();
  vi.stubGlobal("fetch", fetchImpl);
  return await import("@/lib/api");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("verifyRun", () => {
  it("rejects when the backend is reachable but the verify request fails, instead of fabricating a match", async () => {
    const api = await loadApi(async (input) => {
      if (String(input).endsWith("/api/v1/health")) return jsonResponse({ status: "ok" });
      throw new TypeError("network error");
    });

    await expect(api.verifyRun("foresure-1", { probability_pct: 9.99 })).rejects.toThrow();
  });

  it("rejects on a non-2xx verify response with the backend detail", async () => {
    const api = await loadApi(async (input) => {
      if (String(input).endsWith("/api/v1/health")) return jsonResponse({ status: "ok" });
      return jsonResponse({ detail: "Too Many Requests" }, false);
    });

    await expect(api.verifyRun("foresure-1")).rejects.toThrow("Too Many Requests");
  });

  it("offline: a tampered payload is never reported as matched and the result is labelled simulated", async () => {
    const api = await loadApi(async () => {
      throw new TypeError("connection refused");
    });

    const result = await api.verifyRun("foresure-1", { probability_pct: 9.99 });

    expect(result.matched).toBe(false);
    expect(result.tampered_fields).toEqual(["probability_pct"]);
    expect(result.is_mock).toBe(true);
    expect(result.reason).toBeTruthy();
  });

  it("offline: an untampered payload is a simulated match, labelled as such", async () => {
    const api = await loadApi(async () => {
      throw new TypeError("connection refused");
    });

    const result = await api.verifyRun("foresure-1");

    expect(result.matched).toBe(true);
    expect(result.tampered_fields).toEqual([]);
    expect(result.is_mock).toBe(true);
    expect(result.reason).toBeTruthy();
  });
});

describe("chainStatus", () => {
  it("offline: resolves to null instead of a status that claims a Sepolia connection", async () => {
    const api = await loadApi(async () => {
      throw new TypeError("connection refused");
    });

    await expect(api.chainStatus()).resolves.toBeNull();
  });
});

describe("saveLocalRun", () => {
  it("keeps the receipt's mock flag on the stored summary instead of hard-coding it as on-chain", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    });
    const api = await loadApi(async () => {
      throw new TypeError("connection refused");
    });
    const record = {
      ...api_record(),
      blockchain_receipt: { ...api_record().blockchain_receipt, is_mock: true, blockchain_tx_hash: null, verification_url: null },
    };

    api.saveLocalRun(record);

    const { summaries } = api.getLocalStoredRuns();
    expect(summaries[0].chain_is_mock).toBe(true);
    expect(summaries[0].tx_hash).toBeNull();
  });
});

function api_record() {
  return {
    decision_id: "foresure-test",
    timestamp: "20260906_050000",
    news: { title: "t", link: "l", published: "p", summary: "s", is_mock: false },
    matched_products: [],
    actuarial_data: { probability_pct: 1, expected_loss_usd: 1, premium_range_usd: [1, 2] as [number, number], markup_multiplier: [1, 2] as [number, number] },
    proposal_data: {
      proposal: { product_name: "P", target_audience: "", market_gap: "", coverage_details: "", exclusions: "", business_logic: "" },
      is_mock: false,
    },
    blockchain_receipt: {
      decision_id: "foresure-test", payload: {}, data_hash: "0x00", blockchain_tx_hash: "0xdead", block_number: 1,
      verification_url: "https://sepolia.etherscan.io/tx/0xdead", network: "sepolia", is_mock: false, timestamp: "20260906_050000",
    },
    report_path: "reports/x.docx",
  } as unknown as import("@/lib/types").RunRecord;
}
