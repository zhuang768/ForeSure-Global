"use client";

import { useT } from "@/lib/i18n";
import type { NewsItem } from "@/lib/types";

export default function NewsList({ items, selected }: { items: NewsItem[]; selected: NewsItem | null }) {
  const t = useT();
  const ordered = selected ? [selected, ...items.filter((n) => n.title !== selected.title)] : items;
  if (!ordered.length) return <div className="text-sm text-muted">—</div>;
  return (
    <div className="flex flex-col">
      {ordered.map((n) => {
        const isSel = selected?.title === n.title;
        return (
          <a
            key={n.title}
            href={n.link || undefined}
            target="_blank"
            rel="noreferrer"
            className={`border-b border-border py-2 text-sm last:border-0 ${
              isSel ? "-mx-2 rounded-md border-l-4 border-l-primary bg-primary-soft px-2" : ""
            }`}
          >
            <div className="font-medium leading-snug">{n.title}</div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
              {n.source ? <span>{n.source}</span> : null}
              {n.is_mock ? <span className="pill border border-border bg-surface-2 text-muted">mock</span> : null}
              {isSel ? <span className="pill bg-primary-soft text-primary-ink">{t("news.selected")}</span> : null}
            </div>
          </a>
        );
      })}
    </div>
  );
}
