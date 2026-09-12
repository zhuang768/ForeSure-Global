import { describe, expect, it } from "vitest";
import { deriveBadgeState } from "@/lib/badge";
import type { Receipt, VerifyResult } from "@/lib/types";

const base: Receipt = {
  decision_id: "d",
  payload: {},
  data_hash: "ab",
  blockchain_tx_hash: "0xabc",
  block_number: 1,
  verification_url: "u",
  network: "Ethereum Sepolia Testnet",
  is_mock: false,
  timestamp: "t",
};

describe("deriveBadgeState", () => {
  it("is none without a receipt and not pending", () => {
    expect(deriveBadgeState({})).toBe("none");
  });
  it("is pending while anchoring", () => {
    expect(deriveBadgeState({ pending: true })).toBe("pending");
  });
  it("is mock when the receipt says mock, even if a tx hash sneaks in", () => {
    expect(deriveBadgeState({ receipt: { ...base, is_mock: true } })).toBe("mock");
  });
  it("is mock when there is no tx hash", () => {
    expect(deriveBadgeState({ receipt: { ...base, blockchain_tx_hash: null } })).toBe("mock");
  });
  it("is onchain only with a real tx hash", () => {
    expect(deriveBadgeState({ receipt: base })).toBe("onchain");
  });
  it("is mismatch when the last verification failed", () => {
    const verify = { matched: false, is_mock: false } as VerifyResult;
    expect(deriveBadgeState({ receipt: base, verify })).toBe("mismatch");
  });
  it("stays onchain when verification matched", () => {
    const verify = { matched: true, is_mock: false } as VerifyResult;
    expect(deriveBadgeState({ receipt: base, verify })).toBe("onchain");
  });
});
