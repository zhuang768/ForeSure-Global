"use client";

import { fmtStamp } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import type { RunSummary } from "@/lib/types";

export default function KpiBar({ runs, newsCount }: { runs: RunSummary[]; newsCount: number | null }) {
  const t = useT();
  const { present } = usePrefs();
  if (present) return null;
  const onchain = runs.filter((r) => r.chain_is_mock === false && r.tx_hash).length;
  const tiles: [string, string][] = [
    [t("kpi.total"), String(runs.length)],
    [t("kpi.onchain"), String(onchain)],
    [t("kpi.news"), newsCount === null ? "—" : String(newsCount)],
    [t("kpi.last"), runs[0] ? fmtStamp(runs[0].timestamp) : "—"],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map(([label, value]) => (
        <div key={label} className="card px-4 py-3">
          <div className="label">{label}</div>
          <div className="mono text-xl font-semibold">{value}</div>
        </div>
      ))}
    </div>
  );
}
