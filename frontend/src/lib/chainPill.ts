import type { DictKey } from "@/lib/i18n";
import type { ChainStatus } from "@/lib/types";

export type ChainTone = "onchain" | "mock" | "offline";

/**
 * Header pill for the chain status, in three honest states: the backend reports a real Sepolia
 * connection, the backend is up but its chain writer is simulating, or no backend could be reached.
 * `undefined` means the probe has not finished yet, so nothing is shown rather than a guess.
 */
export function describeChain(chain: ChainStatus | null | undefined): { key: DictKey; tone: ChainTone } | null {
  if (chain === undefined) return null;
  if (chain === null) return { key: "header.chain.unknown", tone: "offline" };
  if (chain.mode === "sepolia") return { key: "header.chain.sepolia", tone: "onchain" };
  return { key: "header.chain.mock", tone: "mock" };
}
