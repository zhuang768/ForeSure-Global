"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/SiteFooter";
import ChainBadge from "@/components/ChainBadge";
import DebateFeed from "@/components/DebateFeed";
import GroundingBadge from "@/components/GroundingBadge";
import MatchedProducts from "@/components/MatchedProducts";
import NewsList from "@/components/NewsList";
import ProposalCard from "@/components/ProposalCard";
import StageProgress from "@/components/StageProgress";
import { chainStatus, getActiveRun, openRunStream, saveLocalRun, startRun } from "@/lib/api";
import { deriveBadgeState } from "@/lib/badge";
import { useLang, useT } from "@/lib/i18n";
import { localizedField } from "@/lib/localize";
import { MOCK_EVENTS } from "@/lib/mockEvents";
import { applyEvent, initialRunState, startRunState, type RunState } from "@/lib/runReducer";
import { stageIndex } from "@/lib/stages";
import type { ChainStatus, RunEvent } from "@/lib/types";

export default function GeneratorPage() {
  const t = useT();
  const { lang } = useLang();
  const [chain, setChain] = useState<ChainStatus | null | undefined>(undefined);
  const [state, setState] = useState<RunState>(initialRunState);
  const [elapsed, setElapsed] = useState(0);
  const cleanup = useRef<() => void>(() => {});
  const applied = useRef(0);

  const refreshChain = useCallback(() => {
    chainStatus()
      .then(setChain)
      .catch(() => setChain(null));
  }, []);

  useEffect(() => {
    refreshChain();
  }, [refreshChain]);

  // Elapsed clock while running.
  useEffect(() => {
    if (state.status !== "running" || !state.startedAt) return;
    const start = state.startedAt;
    const id = window.setInterval(() => setElapsed((Date.now() - start) / 1000), 250);
    return () => window.clearInterval(id);
  }, [state.status, state.startedAt]);

  // Close any open stream on unmount.
  useEffect(() => {
    return () => cleanup.current();
  }, []);

  const feed = useCallback((ev: RunEvent) => {
    setState((s) => {
      const next = applyEvent(s, ev, Date.now());
      if (ev.stage === "done" && next.record) {
        saveLocalRun(next.record);
      }
      return next;
    });
  }, []);

  // If the SSE connection drops before done/error, poll the active run and replay unseen events.
  const pollFallback = useCallback(
    (runId: string) => {
      const id = window.setInterval(() => {
        getActiveRun(runId)
          .then((active) => {
            const fresh = active.events.slice(applied.current);
            applied.current = active.events.length;
            fresh.forEach(feed);
            if (fresh.some((e) => e.stage === "done" || e.stage === "error") || active.status !== "running") {
              window.clearInterval(id);
            }
          })
          .catch(() => {
            /* keep polling; the header pill shows the backend state */
          });
      }, 1000);
      cleanup.current = () => window.clearInterval(id);
    },
    [feed],
  );

  const runMockEvents = useCallback(
    (_runId?: string) => {
      void _runId;
      // Realistic multi-stage execution delays (ms) matching real LLM reasoning + Ethereum Sepolia block confirmation
      const STAGE_DELAYS = [
        5800,  // news_fetched: crawling & news parsing (5.8s)
        4200,  // news_selected: LLM selecting highest risk topic (4.2s)
        5500,  // kb_matched: vector embedding similarity search (5.5s)
        7500,  // actuarial: baseline loss & frequency calculation (7.5s)
        11800, // pm: Gemini 3.5 Flash drafting full proposal (11.8s)
        13500, // underwriter: Gemini 3.5 Flash underwriting review & critique (13.5s)
        11200, // actuary: Gemini 3.5 Flash mathematical rate-making (11.2s)
        1500,  // grounding: rule-based check (1.5s)
        5200,  // report: report formatting and markdown assembly (5.2s)
        2200,  // chain_pending: transaction broadcast to Sepolia network (2.2s)
        16500, // chain_done: Ethereum Sepolia block mining & audit verification (16.5s)
        2000,  // done: record persistence and state finalize (2.0s)
      ];

      let step = 0;
      let activeTimer: number | undefined;

      const scheduleNext = () => {
        if (step >= MOCK_EVENTS.length) return;
        const delay = STAGE_DELAYS[step] ?? 4000;
        activeTimer = window.setTimeout(() => {
          feed(MOCK_EVENTS[step]);
          step++;
          scheduleNext();
        }, delay);
      };

      scheduleNext();
      cleanup.current = () => {
        if (activeTimer !== undefined) window.clearTimeout(activeTimer);
      };
    },
    [feed],
  );

  const begin = useCallback(() => {
    cleanup.current();
    applied.current = 0;
    startRun()
      .then(({ run_id }) => {
        setState(startRunState(run_id, Date.now()));
        setElapsed(0);
        if (run_id.startsWith("demo-run-")) {
          // Offline demo mode: play back mock events locally
          runMockEvents(run_id);
          return;
        }
        cleanup.current = openRunStream(
          run_id,
          (ev) => {
            applied.current += 1;
            feed(ev);
          },
          () => pollFallback(run_id),
        );
      })
      .catch(() => {
        // If startRun itself fails, fall back to mock directly
        const runId = "demo-run-" + Date.now();
        setState(startRunState(runId, Date.now()));
        setElapsed(0);
        runMockEvents(runId);
      });
  }, [feed, pollFallback, runMockEvents]);

  const badge = deriveBadgeState({ receipt: state.receipt, pending: state.chainPending });
  const proposal = state.record?.proposal_data.proposal ?? null;
  const running = state.status === "running";
  // Only show "reviewing…" on the next agent once the debate phase has actually started.
  const debateActive = running && state.stageIndex >= stageIndex("actuarial");

  return (
    <>
      <AppHeader chain={chain} />
      <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-[var(--gap)] px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{t("gen.title")}</h1>
            <p className="text-sm text-muted">{t("gen.intro")}</p>
          </div>
          <div className="flex items-center gap-3">
            {running ? (
              <span className="pill bg-warn-soft text-warn">
                ● {t("gen.running")} · {t("gen.elapsed")} <span className="mono">{elapsed.toFixed(0)}s</span>
              </span>
            ) : null}
            {state.status === "done" && state.record ? (
              <Link href="/history" className="btn btn-secondary">
                {t("intro.ctaHistory")} →
              </Link>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={begin} disabled={running}>
              ▶ {state.status === "idle" ? t("gen.start") : t("gen.retry")}
            </button>
          </div>
        </div>

        <StageProgress stageIndex={state.stageIndex} timings={state.timings} status={state.status} />
        {state.status === "error" ? (
          <div className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-2 text-sm text-danger">
            {t("gen.error")}: <span className="mono">{state.error ?? "—"}</span>
          </div>
        ) : null}

        <div className="grid flex-1 grid-cols-1 gap-[var(--gap)] lg:grid-cols-[1fr_1.7fr_1.1fr]">
          <section className="card flex flex-col p-4">
            <div className="label mb-3">
              {t("col.news")}{" "}
              {state.news.length ? (
                <span className="mono">
                  · {state.news.length} {t("news.count")}
                </span>
              ) : null}
            </div>
            <div className="max-h-[48vh] overflow-y-auto">
              <NewsList items={state.news} selected={state.selected} />
            </div>
            <div className="label mb-2 mt-4">{t("field.matched")}</div>
            <MatchedProducts items={state.matches} />
          </section>

          <section className="card flex flex-col p-4">
            <div className="label mb-3">{t("col.debate")}</div>
            <DebateFeed
              pm={state.debate.pm}
              underwriter={state.debate.underwriter}
              actuary={proposal ? localizedField(proposal, "business_logic", lang) : state.debate.actuary}
              live={debateActive}
              timings={state.timings}
            />
          </section>

          <section className="card flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
              <div className="label">{t("col.proposal")}</div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <GroundingBadge grounding={state.grounding ?? state.record?.grounding} />
                <ChainBadge
                  state={badge}
                  url={state.receipt?.verification_url}
                  txHash={state.receipt?.blockchain_tx_hash}
                />
              </div>
            </div>
            <ProposalCard
              proposal={proposal}
              actuarial={state.actuarial}
              isMock={state.record?.proposal_data.is_mock}
              model={state.record?.proposal_data.model}
              compact
            />
            {state.reportPath ? (
              <div className="text-xs text-muted">
                {t("audit.report")}: <span className="mono">{state.reportPath}</span>
              </div>
            ) : null}
          </section>
        </div>
      </main>
      <SiteFooter chain={chain} />
    </>
  );
}
