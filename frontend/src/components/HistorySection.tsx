"use client";

import Link from "next/link";
import GroundingBadge from "@/components/GroundingBadge";
import { fmtStamp, shortHash } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { RunRecord, RunSummary } from "@/lib/types";

export default function HistorySection({
  runs,
  activeRecord,
}: {
  runs: RunSummary[];
  activeRecord?: RunRecord | null;
}) {
  const t = useT();
  const onchainCount = runs.filter((r) => r.chain_is_mock === false && r.tx_hash).length;

  return (
    <section className="card flex flex-col overflow-hidden p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold tracking-tight">{t("history.title")}</h2>
            <span className="pill bg-primary-soft text-primary-ink font-semibold">
              ● {onchainCount} / {runs.length} {t("history.onchainPill")}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">{t("history.subtitle")}</p>
        </div>
        <Link href="/overview" className="btn btn-secondary text-xs">
          {t("header.home")} →
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-2.5 max-h-[580px] overflow-y-auto pr-1">
        {runs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">{t("history.empty")}</div>
        ) : (
          runs.map((r, index) => {
            const isLatestNew = activeRecord && activeRecord.decision_id === r.decision_id;
            const onchain = r.chain_is_mock === false && Boolean(r.tx_hash);

            return (
              <div
                key={r.decision_id}
                className={`flex flex-col gap-2 rounded-lg border p-4 transition-colors md:flex-row md:items-center md:justify-between ${
                  isLatestNew
                    ? "border-primary bg-primary-soft/40 shadow-sm"
                    : index === 0
                      ? "border-border bg-surface-2/60 hover:bg-surface-2"
                      : "border-border bg-surface hover:bg-surface-2/50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-base text-text truncate">
                      {r.product_name ?? "—"}
                    </span>
                    {isLatestNew ? (
                      <span className="pill bg-primary text-white text-[0.65rem] uppercase font-bold">
                        NEW
                      </span>
                    ) : null}
                  </div>
                  {r.news_title ? (
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {t("field.news")}: {r.news_title}
                    </div>
                  ) : null}
                  <div className="mono mt-1 text-[0.7rem] text-muted flex items-center gap-2">
                    <span>{r.decision_id}</span>
                    <span>·</span>
                    <span>{fmtStamp(r.timestamp)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 md:pt-0">
                  <GroundingBadge status={r.grounding_status} />
                  {onchain ? (
                    r.verification_url ? (
                      <a
                        href={r.verification_url}
                        target="_blank"
                        rel="noreferrer"
                        className="pill bg-primary-soft text-primary-ink hover:underline"
                        title="View on Ethereum Sepolia Etherscan"
                      >
                        ✓ {t("badge.onchain")}{" "}
                        <span className="mono opacity-80">{shortHash(r.tx_hash)}</span>
                      </a>
                    ) : (
                      <span className="pill bg-primary-soft text-primary-ink">
                        ✓ {t("badge.onchain")}{" "}
                        <span className="mono opacity-80">{shortHash(r.tx_hash)}</span>
                      </span>
                    )
                  ) : (
                    <span className="pill border border-border bg-surface-2 text-muted">
                      ○ {t("history.mockPill")}
                    </span>
                  )}

                  <Link
                    href={`/overview?id=${encodeURIComponent(r.decision_id)}`}
                    className="btn btn-secondary px-3 py-1.5 text-xs whitespace-nowrap"
                  >
                    {t("history.viewDetail")} →
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
