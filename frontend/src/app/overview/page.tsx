"use client";

import { useCallback, useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/SiteFooter";
import DecisionDetail from "@/components/DecisionDetail";
import KpiBar from "@/components/KpiBar";
import RedTeamPanel from "@/components/RedTeamPanel";
import RunQueue from "@/components/RunQueue";
import VerifyPanel from "@/components/VerifyPanel";
import { chainStatus, getRun, listRuns } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { ChainStatus, RunRecord, RunSummary } from "@/lib/types";

type Loaded = {
  runs: RunSummary[];
  chain: ChainStatus | null;
  offline: boolean;
  selectedId: string | null;
};

export default function OverviewPage() {
  const t = useT();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [record, setRecord] = useState<RunRecord | null>(null);

  // Promise chain rather than async/await so no setState runs synchronously inside the effect.
  const load = useCallback(() => {
    Promise.all([listRuns(), chainStatus().catch(() => null)])
      .then(([runs, chain]) => {
        const fromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("id") : null;
        const selectedId =
          fromUrl && runs.some((r) => r.decision_id === fromUrl) ? fromUrl : (runs[0]?.decision_id ?? null);
        setLoaded({ runs, chain, offline: false, selectedId });
      })
      .catch(() => setLoaded({ runs: [], chain: null, offline: true, selectedId: null }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedId = loaded?.selectedId ?? null;

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    getRun(selectedId)
      .then((r) => {
        if (!cancelled) setRecord(r);
      })
      .catch(() => {
        if (!cancelled) setRecord(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const select = (id: string) => {
    setLoaded((prev) => (prev ? { ...prev, selectedId: id } : prev));
    window.history.replaceState(null, "", `/overview?id=${encodeURIComponent(id)}`);
  };

  const runs = loaded?.runs ?? [];
  const current = record && record.decision_id === selectedId ? record : null;

  return (
    <>
      <AppHeader chain={loaded === null ? undefined : loaded.chain} />
      <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-[var(--gap)] px-5 py-5">
        <KpiBar runs={runs} newsCount={null} />
        <div className="grid min-h-[70vh] flex-1 grid-cols-1 gap-[var(--gap)] lg:grid-cols-[minmax(280px,1fr)_2.2fr]">
          <RunQueue runs={runs} selectedId={selectedId} onSelect={select} />
          {current ? (
            <DecisionDetail record={current}>
              <VerifyPanel record={current} />
            </DecisionDetail>
          ) : (
            <div className="card flex items-center justify-center p-10 text-sm text-muted">
              {loaded === null || (selectedId && !current) ? "…" : t("queue.empty")}
            </div>
          )}
        </div>
        <RedTeamPanel />
      </main>
      <SiteFooter chain={loaded === null ? undefined : loaded.chain} />
    </>
  );
}
