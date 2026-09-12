"use client";

import type { BadgeState } from "@/lib/badge";
import { shortHash } from "@/lib/format";
import { useT } from "@/lib/i18n";

export default function ChainBadge({
  state,
  url,
  txHash,
}: {
  state: BadgeState;
  url?: string | null;
  txHash?: string | null;
}) {
  const t = useT();
  if (state === "none") return null;
  if (state === "pending") return <span className="pill bg-warn-soft text-warn pulse">● {t("badge.pending")}</span>;
  if (state === "mock")
    return <span className="pill border border-border bg-surface-2 text-muted">○ {t("badge.mock")}</span>;
  if (state === "mismatch") return <span className="pill bg-danger-soft text-danger">✕ {t("badge.mismatch")}</span>;
  const inner = (
    <>
      ✓ {t("badge.onchain")} {txHash ? <span className="mono opacity-70">{shortHash(txHash)}</span> : null}
    </>
  );
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="pill bg-primary-soft text-primary-ink hover:underline">
      {inner}
    </a>
  ) : (
    <span className="pill bg-primary-soft text-primary-ink">{inner}</span>
  );
}
