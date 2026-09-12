import { describe, expect, it } from "vitest";
import { describeChain } from "@/lib/chainPill";

describe("describeChain", () => {
  it("renders nothing while the status is still loading", () => {
    expect(describeChain(undefined)).toBeNull();
  });
  it("says the backend is offline when no status could be fetched", () => {
    expect(describeChain(null)).toEqual({ key: "header.chain.unknown", tone: "offline" });
  });
  it("says mock mode when the backend is up but the chain writer is simulating", () => {
    expect(describeChain({ mode: "mock", rpc_url: null, contract_address: null, submitter: null }))
      .toEqual({ key: "header.chain.mock", tone: "mock" });
  });
  it("only claims a Sepolia connection when the backend reports sepolia", () => {
    expect(describeChain({ mode: "sepolia", rpc_url: "https://rpc", contract_address: "0xabc", submitter: "0xdef" }))
      .toEqual({ key: "header.chain.sepolia", tone: "onchain" });
  });
});
