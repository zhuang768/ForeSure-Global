import { describe, expect, it } from "vitest";
import { deriveBadgeState } from "@/lib/badge";
import { MOCK_RUN_RECORDS, MOCK_RUN_SUMMARIES } from "@/lib/mockData";

/** The offline demo data is shown when no backend is reachable, so nothing in it may pose as a real chain record. */
describe("offline demo data", () => {
  it("never presents a demo summary as anchored on chain", () => {
    for (const s of MOCK_RUN_SUMMARIES) {
      expect(s.chain_is_mock, s.decision_id).toBe(true);
      expect(s.tx_hash, s.decision_id).toBeNull();
      expect(s.verification_url, s.decision_id).toBeNull();
    }
  });
  it("gives every demo record a receipt that the badge logic reads as mock", () => {
    for (const r of MOCK_RUN_RECORDS) {
      expect(r.blockchain_receipt.is_mock, r.decision_id).toBe(true);
      expect(r.blockchain_receipt.blockchain_tx_hash, r.decision_id).toBeNull();
      expect(deriveBadgeState({ receipt: r.blockchain_receipt }), r.decision_id).toBe("mock");
    }
  });
});

describe("offline generator simulation", () => {
  it("ends with a receipt that is labelled mock and carries no explorer link", async () => {
    const { MOCK_EVENTS } = await import("@/lib/mockEvents");
    const done = MOCK_EVENTS.find((e) => e.stage === "chain_done");
    expect(done).toBeDefined();
    const receipt = done!.data as { is_mock: boolean; blockchain_tx_hash: string | null; verification_url: string | null };
    expect(receipt.is_mock).toBe(true);
    expect(receipt.blockchain_tx_hash).toBeNull();
    expect(receipt.verification_url).toBeNull();
  });
});
