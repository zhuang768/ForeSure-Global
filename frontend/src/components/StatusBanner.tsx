"use client";

import { API_BASE } from "@/lib/api";
import { useT } from "@/lib/i18n";

export default function StatusBanner({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <div className="border-b border-danger/30 bg-danger-soft text-danger">
      <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-5 py-2 text-sm">
        <span>
          {t("banner.offline")} <span className="mono">{API_BASE}</span>
        </span>
        <button type="button" className="btn btn-secondary px-2 py-1 text-xs" onClick={onRetry}>
          {t("banner.retry")}
        </button>
      </div>
    </div>
  );
}
