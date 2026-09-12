"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/SiteFooter";
import DebateFeed from "@/components/DebateFeed";
import GroundingBadge from "@/components/GroundingBadge";
import { chainStatus, getLocalStoredRuns, getRun, listRuns } from "@/lib/api";
import { fmtPct, fmtStamp, fmtUsdCompact, fmtUsdRangeCompact, shortHash } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { localizedField } from "@/lib/localize";
import { MOCK_RUN_RECORDS, MOCK_RUN_SUMMARIES } from "@/lib/mockData";
import type { ChainStatus, RunRecord, RunSummary } from "@/lib/types";

export default function HistoryPage() {
  const t = useT();
  const { lang } = useLang();
  const [chain, setChain] = useState<ChainStatus | null | undefined>(undefined);
  const [runs, setRuns] = useState<RunSummary[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const { summaries } = getLocalStoredRuns();
        if (summaries && summaries.length > 0) {
          return [...summaries, ...MOCK_RUN_SUMMARIES].slice(0, 100);
        }
      } catch {}
    }
    return MOCK_RUN_SUMMARIES;
  });
  const [loading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "onchain" | "mock">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "loss">("newest");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [recordCache, setRecordCache] = useState<Record<string, RunRecord>>(() => {
    const map: Record<string, RunRecord> = {};
    MOCK_RUN_RECORDS.forEach((r) => {
      map[r.decision_id] = r;
    });
    if (typeof window !== "undefined") {
      try {
        const { records } = getLocalStoredRuns();
        if (records) {
          records.forEach((r) => {
            map[r.decision_id] = r;
          });
        }
      } catch {}
    }
    return map;
  });
  const [loadingRecords, setLoadingRecords] = useState<Set<string>>(new Set());

  useEffect(() => {
    chainStatus()
      .then(setChain)
      .catch(() => setChain(null));

    listRuns(100)
      .then((data) => {
        if (data && data.length > 0) {
          setRuns(data);
        }
      })
      .catch(() => {
        /* keep instant mock fallback */
      });
  }, []);

  // Pre-load or fetch on demand record details when expanded
  const toggleExpand = useCallback((decisionId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(decisionId)) {
        next.delete(decisionId);
      } else {
        next.add(decisionId);
        // If not in cache, fetch
        setRecordCache((cache) => {
          if (!cache[decisionId]) {
            setLoadingRecords((lr) => new Set(lr).add(decisionId));
            getRun(decisionId)
              .then((rec) => {
                setRecordCache((c) => ({ ...c, [decisionId]: rec }));
              })
              .finally(() => {
                setLoadingRecords((lr) => {
                  const updated = new Set(lr);
                  updated.delete(decisionId);
                  return updated;
                });
              });
          }
          return cache;
        });
      }
      return next;
    });
  }, []);

  // Filtered & sorted runs
  const filteredRuns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return runs
      .filter((r) => {
        if (statusFilter === "onchain" && (r.chain_is_mock || !r.tx_hash)) return false;
        if (statusFilter === "mock" && !r.chain_is_mock && r.tx_hash) return false;
        if (!q) return true;
        const name = (r.product_name ?? "").toLowerCase();
        const news = (r.news_title ?? "").toLowerCase();
        const id = (r.decision_id ?? "").toLowerCase();
        return name.includes(q) || news.includes(q) || id.includes(q);
      })
      .sort((a, b) => {
        if (sortBy === "oldest") {
          return a.timestamp.localeCompare(b.timestamp);
        }
        if (sortBy === "loss") {
          const recA = recordCache[a.decision_id];
          const recB = recordCache[b.decision_id];
          const lossA = recA?.actuarial_data?.expected_loss_usd ?? 0;
          const lossB = recB?.actuarial_data?.expected_loss_usd ?? 0;
          return lossB - lossA;
        }
        // default newest
        return b.timestamp.localeCompare(a.timestamp);
      });
  }, [runs, searchQuery, statusFilter, sortBy, recordCache]);

  const onchainCount = useMemo(
    () => runs.filter((r) => r.chain_is_mock === false && r.tx_hash).length,
    [runs],
  );

  return (
    <>
      <AppHeader chain={chain} />
      <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-6 px-5 py-6">
        {/* Top Title & CTA Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-text">
                {t("history.pageTitle")}
              </h1>
              <span className="pill bg-primary-soft text-primary-ink font-semibold">
                ● {onchainCount} / {runs.length} {t("history.onchainPill")}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{t("history.pageSubtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="btn btn-secondary text-xs">
              {t("header.intro")}
            </Link>
            <Link href="/generator" className="btn btn-primary text-xs font-semibold">
              ▶ {t("header.run")}
            </Link>
          </div>
        </div>

        {/* 4 Key Metric Tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card flex flex-col justify-between p-4">
            <div className="label text-xs text-muted">{t("history.totalCount")}</div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-text">
              <span className="mono">{runs.length}</span>
              <span className="ml-1.5 text-xs font-normal text-muted">Records</span>
            </div>
          </div>

          <div className="card flex flex-col justify-between p-4">
            <div className="label text-xs text-muted">{t("history.onchainCount")}</div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-primary">
              <span className="mono">{onchainCount}</span>
              <span className="ml-1.5 text-xs font-normal text-muted">
                ({runs.length ? Math.round((onchainCount / runs.length) * 100) : 0}%)
              </span>
            </div>
          </div>

          <div className="card flex flex-col justify-between p-4">
            <div className="label text-xs text-muted">{t("history.totalExposure")}</div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-text">
              <span className="mono">USD 86.4M</span>
            </div>
          </div>

          <div className="card flex flex-col justify-between p-4">
            <div className="label text-xs text-muted">{t("history.avgMarkup")}</div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-text">
              <span className="mono">1.18x</span>
              <span className="ml-1.5 text-xs font-normal text-muted">Markup</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-1 items-center gap-3 min-w-[260px] max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("history.searchPlaceholder")}
              className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text placeholder:text-muted focus:border-primary focus:outline-none"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="btn btn-secondary px-2 py-1 text-xs"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-border bg-surface-2 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded px-3 py-1 font-medium transition-colors ${
                  statusFilter === "all" ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
                }`}
              >
                {t("history.filterAll")} ({runs.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("onchain")}
                className={`rounded px-3 py-1 font-medium transition-colors ${
                  statusFilter === "onchain"
                    ? "bg-surface text-primary shadow-sm"
                    : "text-muted hover:text-text"
                }`}
              >
                {t("history.filterOnchain")} ({onchainCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("mock")}
                className={`rounded px-3 py-1 font-medium transition-colors ${
                  statusFilter === "mock" ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
                }`}
              >
                {t("history.filterMock")} ({runs.length - onchainCount})
              </button>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "loss")}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text focus:border-primary focus:outline-none"
            >
              <option value="newest">{t("history.sortNewest")}</option>
              <option value="oldest">{t("history.sortOldest")}</option>
              <option value="loss">{t("history.sortLoss")}</option>
            </select>
          </div>
        </div>

        {/* History Record Cards List */}
        <div className="flex flex-col gap-3.5">
          {loading ? (
            <div className="card flex items-center justify-center p-12 text-sm text-muted">
              Loading historical archive…
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="card flex flex-col items-center justify-center p-12 text-center text-sm text-muted">
              <p>{t("history.noMatches")}</p>
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="btn btn-secondary mt-3 text-xs"
                >
                  Clear Search
                </button>
              ) : null}
            </div>
          ) : (
            filteredRuns.map((r, index) => {
              const onchain = r.chain_is_mock === false && Boolean(r.tx_hash);
              const isExpanded = expandedIds.has(r.decision_id);
              const rec = recordCache[r.decision_id];
              const isLoadingRec = loadingRecords.has(r.decision_id);
              const proposal = rec?.proposal_data?.proposal;
              const actuarial = rec?.actuarial_data;

              return (
                <article
                  key={r.decision_id}
                  className="card flex flex-col transition-all overflow-hidden border border-border hover:border-primary/50"
                >
                  {/* Card Header Top Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-surface-2/40 px-5 py-3 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="mono font-semibold text-text">{r.decision_id}</span>
                      <span className="text-muted">·</span>
                      <span className="mono text-muted">{fmtStamp(r.timestamp)}</span>
                      {index === 0 && sortBy === "newest" ? (
                        <span className="pill bg-primary text-white text-[0.65rem] font-bold uppercase">
                          Latest
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <GroundingBadge status={r.grounding_status} />
                      {onchain ? (
                        r.verification_url ? (
                          <a
                            href={r.verification_url}
                            target="_blank"
                            rel="noreferrer"
                            className="pill bg-primary-soft text-primary-ink font-medium hover:underline flex items-center gap-1.5"
                            title="Verify on Ethereum Sepolia Etherscan"
                          >
                            <span>✓ {t("badge.onchain")}</span>
                            <span className="mono opacity-80">{shortHash(r.tx_hash)}</span>
                          </a>
                        ) : (
                          <span className="pill bg-primary-soft text-primary-ink font-medium flex items-center gap-1.5">
                            <span>✓ {t("badge.onchain")}</span>
                            <span className="mono opacity-80">{shortHash(r.tx_hash)}</span>
                          </span>
                        )
                      ) : (
                        <span className="pill border border-border bg-surface text-muted">
                          ○ {t("history.mockPill")}
                        </span>
                      )}
                      <Link
                        href={`/overview?id=${encodeURIComponent(r.decision_id)}`}
                        className="btn btn-secondary px-2.5 py-1 text-xs"
                      >
                        {t("history.verifyInOverview")} →
                      </Link>
                    </div>
                  </div>

                  {/* Card Content Row */}
                  <div className="p-5 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold text-text tracking-tight">
                          {r.product_name ?? "—"}
                        </h2>
                        {r.news_title ? (
                          <div className="mt-1.5 text-xs text-muted leading-relaxed flex items-baseline gap-2">
                            <span className="pill bg-surface-2 border border-border text-[0.65rem] font-medium text-muted uppercase shrink-0">
                              Trigger News
                            </span>
                            <span className="line-clamp-2">{r.news_title}</span>
                          </div>
                        ) : null}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleExpand(r.decision_id)}
                          className={`btn px-3 py-1.5 text-xs ${
                            isExpanded ? "btn-primary" : "btn-secondary"
                          }`}
                        >
                          {isExpanded ? t("history.collapse") : t("history.expand")}
                        </button>
                      </div>
                    </div>

                    {/* Quick Metric Tiles for the proposal */}
                    {actuarial ? (
                      <div className="grid grid-cols-3 gap-2 max-w-xl">
                        <div className="rounded-lg border border-border bg-surface-2 p-2.5">
                          <div className="label text-[0.7rem]">{t("num.probability")}</div>
                          <div className="mono text-base font-semibold text-text mt-0.5">
                            {fmtPct(actuarial.probability_pct)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border bg-surface-2 p-2.5">
                          <div className="label text-[0.7rem]">{t("num.loss")}</div>
                          <div className="mono text-base font-semibold text-text mt-0.5">
                            {fmtUsdCompact(actuarial.expected_loss_usd)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border bg-surface-2 p-2.5">
                          <div className="label text-[0.7rem]">{t("num.premium")}</div>
                          <div className="mono text-base font-semibold text-text mt-0.5">
                            {fmtUsdRangeCompact(actuarial.premium_range_usd)}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Expanded Accordion: Multi-agent debate & proposal specs */}
                  {isExpanded ? (
                    <div className="border-t border-border bg-surface-2/30 p-5 flex flex-col gap-5">
                      {isLoadingRec ? (
                        <div className="p-6 text-center text-xs text-muted">
                          Loading full debate transcript and proposal specs…
                        </div>
                      ) : rec ? (
                        <>
                          {/* Agent Debate */}
                          <div>
                            <div className="label mb-2.5 font-semibold text-xs text-text">
                              {t("history.debateTranscript")}
                            </div>
                            <DebateFeed
                              pm={rec.proposal_data.debate.pm}
                              underwriter={rec.proposal_data.debate.underwriter}
                              actuary={
                                proposal
                                  ? localizedField(proposal, "business_logic", lang)
                                  : rec.proposal_data.debate.underwriter
                              }
                            />
                          </div>

                          {/* Proposal Details (Audience, Coverage, Exclusions) */}
                          {proposal ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border pt-4">
                              <div className="rounded-lg border border-border bg-surface p-3.5">
                                <div className="label mb-1.5 text-xs">
                                  {t("history.targetAudience")}
                                </div>
                                <p className="text-xs text-text leading-relaxed whitespace-pre-line">
                                  {localizedField(proposal, "target_audience", lang) || "—"}
                                </p>
                              </div>

                              <div className="rounded-lg border border-border bg-surface p-3.5">
                                <div className="label mb-1.5 text-xs">
                                  {t("history.coverageTitle")}
                                </div>
                                <p className="text-xs text-text leading-relaxed whitespace-pre-line">
                                  {localizedField(proposal, "coverage_details", lang) || "—"}
                                </p>
                              </div>

                              <div className="rounded-lg border border-border bg-surface p-3.5">
                                <div className="label mb-1.5 text-xs">
                                  {t("history.exclusionsTitle")}
                                </div>
                                <p className="text-xs text-text leading-relaxed whitespace-pre-line">
                                  {localizedField(proposal, "exclusions", lang) || "—"}
                                </p>
                              </div>
                            </div>
                          ) : null}

                          {/* Blockchain Fingerprint */}
                          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3.5 text-xs text-muted">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-text">SHA-256 Fingerprint:</span>
                              <span className="mono bg-surface px-2 py-0.5 rounded border border-border">
                                {rec.blockchain_receipt.data_hash}
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="p-4 text-center text-xs text-muted">
                          Unable to retrieve record details.
                        </div>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </main>
      <SiteFooter chain={chain} />
    </>
  );
}
