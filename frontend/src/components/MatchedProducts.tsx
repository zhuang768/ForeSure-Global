"use client";

import type { MatchedProduct } from "@/lib/types";

export default function MatchedProducts({ items }: { items: MatchedProduct[] }) {
  if (!items.length) return <span className="text-sm text-muted">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((m) => (
        <span key={m.id} className="pill border border-border bg-surface-2 text-text" title={m.description}>
          {m.name}
          <span className="mono text-[0.65rem] text-muted">{m.category}</span>
        </span>
      ))}
    </div>
  );
}
