"use client";

import type React from "react";
import { fmtPct, fmtUsdCompact, fmtUsdRangeCompact } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { localizedField } from "@/lib/localize";
import type { ActuarialData, Proposal } from "@/lib/types";

/** Small provenance tag under a number: official statistics vs assumption (docs/API.md "精算依據"). */
function BasisTag({ source, lowSample }: { source: string | undefined; lowSample?: boolean | null }) {
  const t = useT();
  if (!source) return null;
  const isStat = source !== "assumption";
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      <span className={`pill ${isStat ? "bg-primary-soft text-primary-ink" : "bg-warn-soft text-warn"}`}>
        {isStat ? t("basis.stat") : t("basis.assumption")}
      </span>
      {lowSample ? <span className="pill bg-warn-soft text-warn">{t("basis.lowSample")}</span> : null}
    </div>
  );
}

export function NumberTiles({ actuarial }: { actuarial: ActuarialData | null }) {
  const t = useT();
  // Tiles are three narrow columns; NFA-backed figures reach hundreds of millions, so compact here
  // and leave the full digits to the pricing tab in DecisionDetail.
  const premium = fmtUsdRangeCompact(actuarial?.premium_range_usd);
  const basis = actuarial?.basis ?? null;
  const tiles: [string, string, React.ReactNode][] = [
    [t("num.probability"), fmtPct(actuarial?.probability_pct), <BasisTag key="p" source={basis?.probability_source} lowSample={basis?.low_sample} />],
    [t("num.loss"), fmtUsdCompact(actuarial?.expected_loss_usd), <BasisTag key="l" source={basis?.loss_source} />],
    [t("num.premium"), premium, null],
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map(([label, value, tag]) => (
        <div key={label} className="rounded-lg border border-border bg-surface-2 p-3">
          <div className="label">{label}</div>
          <div className={`mono text-lg font-semibold ${value === "—" ? "text-muted" : ""}`}>{value}</div>
          {tag}
        </div>
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <p className="whitespace-pre-line text-sm leading-relaxed">{value && value.length ? value : "—"}</p>
    </div>
  );
}

export default function ProposalCard({
  proposal,
  actuarial,
  isMock,
  model,
  compact = false,
}: {
  proposal: Proposal | null;
  actuarial: ActuarialData | null;
  isMock?: boolean;
  model?: string | null;
  compact?: boolean;
}) {
  const t = useT();
  const { lang } = useLang();
  const f = (field: Parameters<typeof localizedField>[1]) => localizedField(proposal, field, lang);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="label">{t("field.product")}</div>
        <h3 className={`font-bold leading-tight ${compact ? "text-lg" : "text-2xl"} ${proposal ? "" : "text-muted"}`}>
          {proposal ? f("product_name") : "—"}
        </h3>
        {isMock ? <div className="mt-1 text-xs text-warn">{t("field.mockProposal")}</div> : null}
        {model ? (
          <div className="mt-1 text-xs text-muted">
            {t("field.model")}: <span className="mono">{model}</span>
          </div>
        ) : null}
      </div>
      <NumberTiles actuarial={actuarial} />
      {!compact && proposal ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t("field.audience")} value={f("target_audience")} />
          <Field label={t("field.gap")} value={f("market_gap")} />
          <Field label={t("field.coverage")} value={f("coverage_details")} />
          <Field label={t("field.exclusions")} value={f("exclusions")} />
        </div>
      ) : null}
    </div>
  );
}
