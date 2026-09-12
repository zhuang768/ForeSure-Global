"use client";

import { fmtSeconds } from "@/lib/format";
import { useT, type DictKey } from "@/lib/i18n";
import { STAGES } from "@/lib/stages";
import type { Stage } from "@/lib/types";

export default function StageProgress({
  stageIndex,
  timings,
  status,
}: {
  stageIndex: number;
  timings: Partial<Record<Stage, number>>;
  status: "idle" | "running" | "done" | "error";
}) {
  const t = useT();
  return (
    <div className="card px-4 py-3">
      <div className="flex gap-1.5">
        {STAGES.map((s, i) => {
          const done = i <= stageIndex;
          const active = status === "running" && i === stageIndex + 1;
          const failed = status === "error" && i === stageIndex + 1;
          return (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${
                failed ? "bg-danger" : done ? "bg-primary" : active ? "bg-primary pulse" : "bg-border"
              }`}
            />
          );
        })}
      </div>
      <div
        className="mt-2 grid text-[0.65rem] text-muted"
        style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(0, 1fr))` }}
      >
        {STAGES.map((s) => (
          <div key={s} className="truncate text-center">
            <div>{t(`stage.${s}` as DictKey)}</div>
            {timings[s] !== undefined ? <div className="mono">{fmtSeconds(timings[s] as number)}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
