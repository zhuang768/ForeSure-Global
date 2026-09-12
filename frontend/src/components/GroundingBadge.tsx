"use client";

import { flagTypeKey, groundingTone } from "@/lib/grounding";
import { useT } from "@/lib/i18n";
import type { Grounding, GroundingStatus } from "@/lib/types";

const TONE_CLASS = {
  pass: "pill bg-primary-soft text-primary-ink",
  warn: "pill bg-warn-soft text-warn",
  fail: "pill bg-danger-soft text-danger",
} as const;
const TONE_MARK = { pass: "✓", warn: "!", fail: "✕" } as const;

/** Verdict pill. Pass `grounding` for the full object (shows the flag count) or just `status` from a summary row. */
export default function GroundingBadge({
  grounding,
  status,
}: {
  grounding?: Grounding | null;
  status?: GroundingStatus | null;
}) {
  const t = useT();
  const tone = groundingTone(grounding?.status ?? status);
  if (tone === "none") return null;
  const count = grounding && tone !== "pass" ? ` (${grounding.flag_count})` : "";
  return (
    <span className={TONE_CLASS[tone]} title={t("grounding.title")}>
      {TONE_MARK[tone]} {t(`grounding.${tone}`)}
      {count}
    </span>
  );
}

/** Counts plus one row per flag, for the audit tab. */
export function GroundingFlags({ grounding }: { grounding: Grounding }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="text-muted">
        {t("grounding.checked")}: <span className="mono">{grounding.checked_claims}</span> ·{" "}
        <span className="mono">{grounding.grounded_claims}</span> {t("grounding.grounded")}
      </div>
      {grounding.flags.length === 0 ? (
        <div className="text-muted">{t("grounding.noFlags")}</div>
      ) : (
        grounding.flags.map((flag, i) => (
          <div key={`${flag.type}-${flag.field}-${i}`} className="rounded-lg border border-border bg-surface-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={flag.severity === "high" ? TONE_CLASS.fail : TONE_CLASS.warn}>{t(flagTypeKey(flag.type))}</span>
              <span className="text-xs text-muted">
                {t("grounding.field")}: <span className="mono">{flag.field}</span>
              </span>
              {flag.value ? <span className="mono text-xs">{flag.value}</span> : null}
            </div>
            {flag.excerpt ? <p className="mt-1 text-xs text-muted">「{flag.excerpt}」</p> : null}
            <p className="mt-1 text-xs">{flag.message}</p>
          </div>
        ))
      )}
      <div className="text-xs text-muted">
        {t("grounding.version")}: <span className="mono">{grounding.checker_version}</span>
      </div>
    </div>
  );
}
