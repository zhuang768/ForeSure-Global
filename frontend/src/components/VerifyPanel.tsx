"use client";

import { useState } from "react";
import { Contract, JsonRpcProvider, type InterfaceAbi } from "ethers";
import abiJson from "@/lib/AuditRegistryABI.json";
import ChainBadge from "@/components/ChainBadge";
import { verifyRun } from "@/lib/api";
import { deriveBadgeState } from "@/lib/badge";
import { fmtUnix, shortHash } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { RunRecord, VerifyResult } from "@/lib/types";

const RPC_URL = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "";
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";
// src/lib/AuditRegistryABI.json is the plain ABI array (not the Hardhat artifact object).
const ABI = abiJson as InterfaceAbi;

type RpcState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; ts: number; submitter: string }
  | { kind: "missing" }
  | { kind: "error" };

export default function VerifyPanel({ record }: { record: RunRecord }) {
  const t = useT();
  const receipt = record.blockchain_receipt;
  const storedProb = Number(receipt.payload?.probability_pct ?? record.actuarial_data.probability_pct);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tamperOpen, setTamperOpen] = useState(false);
  const [tamperValue, setTamperValue] = useState(String(Math.round((storedProb + 5) * 100) / 100));
  const [rpc, setRpc] = useState<RpcState>({ kind: "idle" });

  const run = (tampered?: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    verifyRun(record.decision_id, tampered)
      .then(setResult)
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  const readContract = () => {
    if (!RPC_URL || !CONTRACT_ADDRESS) {
      setRpc({ kind: "error" });
      return;
    }
    setRpc({ kind: "loading" });
    const contract = new Contract(CONTRACT_ADDRESS, ABI, new JsonRpcProvider(RPC_URL));
    contract
      .getRecord(receipt.decision_id)
      .then((rec: { timestamp: bigint; submitter: string }) => {
        const ts = Number(rec.timestamp);
        setRpc(ts > 0 ? { kind: "found", ts, submitter: rec.submitter } : { kind: "missing" });
      })
      .catch(() => setRpc({ kind: "error" }));
  };

  const badge = deriveBadgeState({ receipt, verify: result });
  const mock = receipt.is_mock;

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="label">{t("verify.title")}</span>
        <ChainBadge state={badge} url={receipt.verification_url} txHash={receipt.blockchain_tx_hash} />
      </div>
      {mock ? <p className="mb-3 text-sm text-muted">{t("verify.mockReason")}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => run()} disabled={busy || mock}>
          {t("verify.run")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setTamperOpen((v) => !v)} disabled={mock}>
          {t("verify.tamper")}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={readContract}
          disabled={mock || rpc.kind === "loading"}
        >
          {t("verify.rpc")}
        </button>
      </div>
      {tamperOpen ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{t("verify.tamperHint")}</span>
          <label className="flex items-center gap-2">
            <span className="mono text-xs">probability_pct</span>
            <input
              className="mono w-24 rounded border border-border bg-surface px-2 py-1"
              value={tamperValue}
              onChange={(e) => setTamperValue(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-secondary text-danger"
            onClick={() => run({ probability_pct: Number(tamperValue) })}
            disabled={busy}
          >
            {t("verify.run")}
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {result ? (
        <div className="mt-4 text-sm">
          <div className={`mb-2 font-bold ${result.matched ? "text-primary-ink" : "text-danger"}`}>
            {result.matched ? "✓ " + t("verify.matched") : "✕ " + t("verify.notMatched")}
          </div>
          {result.reason ? <p className="mb-2 text-xs text-warn">{result.reason}</p> : null}
          <div className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
            <span className="text-muted">{t("verify.local")}</span>
            <span className="mono break-all">{result.local_hash_hex ?? "—"}</span>
            <span className="text-muted">{t("verify.stored")}</span>
            <span className="mono break-all">{result.stored_hash ?? "—"}</span>
            <span className="text-muted">{t("verify.onchainTime")}</span>
            <span className="mono">{fmtUnix(result.onchain_timestamp)}</span>
            <span className="text-muted">{t("verify.submitter")}</span>
            <span className="mono">{shortHash(result.submitter)}</span>
            {result.tampered_fields.length ? (
              <>
                <span className="text-muted">{t("verify.tampered")}</span>
                <span className="mono text-danger">{result.tampered_fields.join(", ")}</span>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {rpc.kind !== "idle" ? (
        <p className="mt-3 text-xs text-muted">
          {t("verify.rpc")}:{" "}
          {rpc.kind === "loading"
            ? "…"
            : rpc.kind === "found"
              ? `${t("verify.rpcFound")} · ${fmtUnix(rpc.ts)} · ${shortHash(rpc.submitter)}`
              : rpc.kind === "missing"
                ? t("verify.rpcMissing")
                : t("verify.rpcError")}
        </p>
      ) : null}
    </div>
  );
}
