export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return "USD " + Math.round(n).toLocaleString("en-US");
}

export function fmtPct(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return "—";
  return pct.toFixed(2) + "%";
}

export function shortHash(h: string | null | undefined): string {
  if (!h) return "—";
  if (h.length <= 14) return h;
  return `${h.slice(0, 8)}…${h.slice(-4)}`;
}

/** "20260905_021824" -> "2026-09-05 02:18" */
export function fmtStamp(s: string | null | undefined): string {
  if (!s) return "—";
  const m = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/.exec(s);
  if (!m) return s;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
}

/** LLM replies arrive as light markdown; show them as plain prose (keep list numbers and line breaks). */
export function stripMarkdown(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[*-]\s+/gm, "• ");
}

export function fmtSeconds(sec: number): string {
  return `${sec.toFixed(1)}s`;
}

/** Unix seconds -> local "YYYY-MM-DD HH:mm:ss" */
export function fmtUnix(ts: number | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const COMPACT_UNITS: [number, string][] = [
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

/** Number part only: full digits below 100,000; otherwise K/M/B with one decimal ("14.4M", "468M"). */
function compactAmount(n: number): string {
  const abs = Math.abs(n);
  if (abs < 1e5) return Math.round(n).toLocaleString("en-US");
  let i = COMPACT_UNITS.findIndex(([scale]) => abs >= scale);
  let scaled = Number((n / COMPACT_UNITS[i][0]).toFixed(1));
  // 999.96M rounds to 1000.0M; carry into the next larger unit instead.
  if (Math.abs(scaled) >= 1000 && i > 0) {
    i -= 1;
    scaled = Number((n / COMPACT_UNITS[i][0]).toFixed(1));
  }
  return `${scaled}${COMPACT_UNITS[i][1]}`;
}

/** "USD 41,839" below 100,000; "USD 14.4M" above. Tile-sized alternative to fmtUsd. */
export function fmtUsdCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return "USD " + compactAmount(n);
}

/** "USD 15.9M – 26.6M": one prefix, both ends compacted. */
export function fmtUsdRangeCompact(range: readonly [number, number] | null | undefined): string {
  if (!range) return "—";
  const [lo, hi] = range;
  if ([lo, hi].some((v) => v === null || v === undefined || Number.isNaN(v))) return "—";
  return `USD ${compactAmount(lo)} – ${compactAmount(hi)}`;
}
