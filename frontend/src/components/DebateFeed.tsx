"use client";

import { useEffect, useRef, useState } from "react";
import { fmtSeconds, stripMarkdown } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Stage } from "@/lib/types";

type Role = "pm" | "underwriter" | "actuary";
const ROLES: Role[] = ["pm", "underwriter", "actuary"];
const ROLE_STYLE: Record<Role, { avatar: string; short: string }> = {
  pm: { avatar: "bg-role-pm-soft text-role-pm", short: "PM" },
  underwriter: { avatar: "bg-role-uw-soft text-role-uw", short: "核" },
  actuary: { avatar: "bg-role-ac-soft text-role-ac", short: "精" },
};

const REPLAY_CHARS_PER_TICK = 6;
const REPLAY_TICK_MS = 60;

export default function DebateFeed({
  pm,
  underwriter,
  actuary,
  live = false,
  timings,
  replayable = false,
}: {
  pm?: string;
  underwriter?: string;
  actuary?: string;
  live?: boolean;
  timings?: Partial<Record<Stage, number>>;
  replayable?: boolean;
}) {
  const t = useT();
  const texts: Record<Role, string | undefined> = {
    pm: pm ? stripMarkdown(pm) : undefined,
    underwriter: underwriter ? stripMarkdown(underwriter) : undefined,
    actuary: actuary ? stripMarkdown(actuary) : undefined,
  };
  // chars revealed per role while replaying; null = not replaying (show everything)
  const [shown, setShown] = useState<Record<Role, number> | null>(null);
  const timer = useRef<number | null>(null);

  const stopReplay = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setShown(null);
  };

  const startReplay = () => {
    if (timer.current) window.clearInterval(timer.current);
    // Snapshot the texts at replay start (event handler, not render); replay only runs on finished records.
    const snapshot: Record<Role, string> = {
      pm: texts.pm ?? "",
      underwriter: texts.underwriter ?? "",
      actuary: texts.actuary ?? "",
    };
    const progress: Record<Role, number> = { pm: 0, underwriter: 0, actuary: 0 };
    setShown({ ...progress });
    timer.current = window.setInterval(() => {
      const role = ROLES.find((r) => progress[r] < snapshot[r].length);
      if (!role) {
        if (timer.current) window.clearInterval(timer.current);
        timer.current = null;
        setShown(null);
        return;
      }
      progress[role] = Math.min(progress[role] + REPLAY_CHARS_PER_TICK, snapshot[role].length);
      setShown({ ...progress });
    }, REPLAY_TICK_MS);
  };

  useEffect(() => {
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  const labelFor: Record<Role, string> = {
    pm: t("debate.pm"),
    underwriter: t("debate.underwriter"),
    actuary: t("debate.actuary"),
  };
  const firstMissing = ROLES.find((r) => !texts[r]);
  const hasAny = Boolean(pm || underwriter || actuary);

  return (
    <div className="flex flex-col gap-3">
      {replayable && hasAny ? (
        <div className="flex justify-end">
          {shown ? (
            <button type="button" className="btn btn-secondary px-2 py-1 text-xs" onClick={stopReplay}>
              {t("debate.stop")}
            </button>
          ) : (
            <button type="button" className="btn btn-secondary px-2 py-1 text-xs" onClick={startReplay}>
              ▶ {t("debate.replay")}
            </button>
          )}
        </div>
      ) : null}
      {ROLES.map((role) => {
        const text = texts[role];
        const revealed = shown ? text?.slice(0, shown[role]) : text;
        const isWorking = live && !text && role === firstMissing;
        const isWaiting = !text && !isWorking;
        const seconds = timings?.[role];
        return (
          <div key={role} className={`flex gap-3 ${isWaiting ? "opacity-40" : ""}`}>
            <div
              className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-bold ${ROLE_STYLE[role].avatar}`}
            >
              {ROLE_STYLE[role].short}
            </div>
            <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-bold">{labelFor[role]}</span>
                {seconds !== undefined ? <span className="mono text-[0.65rem] text-muted">{fmtSeconds(seconds)}</span> : null}
              </div>
              {text ? (
                <p className="whitespace-pre-line text-sm leading-relaxed">{revealed}</p>
              ) : (
                <p className={`text-sm italic text-muted ${isWorking ? "pulse" : ""}`}>
                  {isWorking ? t("debate.working") : t("debate.waiting")}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
