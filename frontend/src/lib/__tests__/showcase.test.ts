import { describe, expect, it } from "vitest";
import { pickShowcaseRuns, wrapIndex } from "@/lib/showcase";
import type { RunSummary } from "@/lib/types";

function run(over: Partial<RunSummary>): RunSummary {
  return {
    decision_id: "d",
    run_id: null,
    timestamp: "20260906_010000",
    news_title: "news",
    product_name: "product",
    is_mock_proposal: false,
    grounding_status: "pass",
    chain_is_mock: false,
    tx_hash: "0xabc",
    verification_url: null,
    ...over,
  };
}

describe("wrapIndex", () => {
  it("wraps forward past the end and backward before the start", () => {
    expect(wrapIndex(3, 4)).toBe(3);
    expect(wrapIndex(4, 4)).toBe(0);
    expect(wrapIndex(-1, 4)).toBe(3);
    expect(wrapIndex(9, 4)).toBe(1);
  });
  it("returns 0 for an empty list", () => {
    expect(wrapIndex(2, 0)).toBe(0);
  });
});

describe("pickShowcaseRuns", () => {
  it("keeps the incoming order and caps the count", () => {
    const runs = [run({ decision_id: "a" }), run({ decision_id: "b" }), run({ decision_id: "c" }), run({ decision_id: "d" })];
    expect(pickShowcaseRuns(runs, 3).map((r) => r.decision_id)).toEqual(["a", "b", "c"]);
  });
  it("skips fallback proposals and runs without a product name", () => {
    const runs = [
      run({ decision_id: "mock", is_mock_proposal: true }),
      run({ decision_id: "noname", product_name: null }),
      run({ decision_id: "ok" }),
    ];
    expect(pickShowcaseRuns(runs, 3).map((r) => r.decision_id)).toEqual(["ok"]);
  });
  it("puts anchored runs before unanchored ones without reordering within a group", () => {
    const runs = [
      run({ decision_id: "pending", tx_hash: null }),
      run({ decision_id: "first" }),
      run({ decision_id: "second" }),
    ];
    expect(pickShowcaseRuns(runs, 3).map((r) => r.decision_id)).toEqual(["first", "second", "pending"]);
  });
});
