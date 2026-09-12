"use client";

import { useEffect, useState } from "react";
import { redTeamReport } from "@/lib/api";
import { flagTypeKey } from "@/lib/grounding";
import { useT } from "@/lib/i18n";
import { formatRate, isClean, outcomeKey, outcomeTone } from "@/lib/redteam";
import type { RedTeamCase, RedTeamReport } from "@/lib/types";

const TONE_CLASS = {
  good: "pill bg-primary-soft text-primary-ink",
  bad: "pill bg-danger-soft text-danger",
  muted: "pill bg-warn-soft text-warn",
} as const;

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="label">{label}</div>
      <div className="mono mt-1 text-xl font-bold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

function CaseRow({ item }: { item: RedTeamCase }) {
  const t = useT();
  const tone = outcomeTone(item.outcome);
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={TONE_CLASS[tone]}>{t(outcomeKey(item.outcome))}</span>
        <span className="mono text-xs text-muted">{item.id}</span>
        <span className="text-sm font-semibold">{item.title}</span>
      </div>
      <p className="mt-2 text-xs text-muted">{item.description}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="text-muted">
          {t("redteam.caseVerdict")}: <span className="mono">{item.actual_status}</span>
        </span>
        <span className="text-muted">
          {t("redteam.caseFlags")}:{" "}
          {item.actual_flag_types.length === 0 ? (
            <span className="mono">{t("redteam.noFlags")}</span>
          ) : (
            item.actual_flag_types.map((type) => (
              <span key={type} className="mono mr-2">
                {t(flagTypeKey(type))}
              </span>
            ))
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * Measured evidence that the grounding check works, for the "red team" leg of the trustworthy-AI checklist.
 * Reads GET /api/v1/redteam, falling back to the committed snapshot when the backend is unreachable.
 */
export default function RedTeamPanel() {
  const t = useT();
  const [report, setReport] = useState<RedTeamReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    redTeamReport()
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return <div className="card p-4 text-sm text-muted">{t("redteam.error")}</div>;
  if (!report) return <div className="card p-4 text-sm text-muted">…</div>;

  const clean = isClean(report);

  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="label">{t("redteam.title")}</span>
        <span className={clean ? TONE_CLASS.good : TONE_CLASS.bad}>
          {report.detected}/{report.attack_cases} · {formatRate(report.detection_rate)}
        </span>
      </div>
      <p className="mb-3 text-sm text-muted">{t("redteam.intro")}</p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label={t("redteam.detection")}
          value={formatRate(report.detection_rate)}
          hint={`${report.detected}/${report.attack_cases} ${t("redteam.attackCases")}`}
        />
        <Metric
          label={t("redteam.falsePositive")}
          value={formatRate(report.false_positive_rate)}
          hint={`${report.false_positives}/${report.control_cases} ${t("redteam.controlCases")}`}
        />
        <Metric label={t("redteam.knownGaps")} value={String(report.known_gaps_open)} hint={t("redteam.gapNote")} />
        <Metric label={t("redteam.checker")} value={report.checker_version} hint={report.suite_version} />
      </div>

      <p className="mt-3 text-xs text-muted">{t("redteam.controlNote")}</p>
      <p className="mono mt-2 break-all text-xs text-muted">
        {t("redteam.hash")}: {report.report_hash}
      </p>

      <button type="button" className="btn btn-secondary mt-3" onClick={() => setOpen((v) => !v)}>
        {open ? t("redteam.collapse") : t("redteam.expand")} ({report.total_cases})
      </button>
      {open ? (
        <div className="mt-3 flex flex-col gap-2">
          {report.cases.map((item) => (
            <CaseRow key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
