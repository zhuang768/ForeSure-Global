"use client";

import GroundingBadge from "@/components/GroundingBadge";
import { fmtStamp } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { RunSummary } from "@/lib/types";

export default function RunQueue({
  runs,
  selectedId,
  onSelect,
}: {
  runs: RunSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  return (
    <div className="card flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="label">{t("queue.title")}</span>
        <span className="mono text-xs text-muted">{runs.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {runs.length === 0 ? (
          <div className="p-4 text-sm text-muted">{t("queue.empty")}</div>
        ) : (
          runs.map((r) => {
            const active = r.decision_id === selectedId;
            const onchain = r.chain_is_mock === false && Boolean(r.tx_hash);
            return (
              <button
                key={r.decision_id}
                type="button"
                onClick={() => onSelect(r.decision_id)}
                className={`block w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-2 ${
                  active ? "border-l-4 border-l-primary bg-primary-soft" : "border-l-4 border-l-transparent"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{r.product_name ?? "—"}</div>
                    <div className="truncate text-xs text-muted">{r.news_title ?? "—"}</div>
                    <div className="mono mt-1 text-[0.65rem] text-muted">{fmtStamp(r.timestamp)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`pill ${onchain ? "bg-primary-soft text-primary-ink" : "border border-border bg-surface-2 text-muted"}`}
                    >
                      {onchain ? t("queue.onchain") : t("queue.mock")}
                    </span>
                    {r.grounding_status === "warn" || r.grounding_status === "fail" ? (
                      <GroundingBadge status={r.grounding_status} />
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
