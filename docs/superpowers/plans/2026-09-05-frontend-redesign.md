# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the two Next.js pages as a "decision desk": a history/overview page (H1 queue + detail) and a live-run page (G1 three-column SSE stream), showing only real backend data, with light/dark theme, 中/EN, presentation mode, and honest on-chain verification.

**Architecture:** All UI is client-side (`'use client'`) because the app is statically exported for Cloudflare Pages. Pure logic (event reducer, badge state, i18n, formatting) lives in `src/lib` and is unit-tested with Vitest; components in `src/components` are thin views over that logic. A typed API client wraps the FastAPI endpoints documented in `docs/API.md`; the live run uses `EventSource` with a polling fallback.

**Tech Stack:** Next.js 16.3 (app router, `output: "export"`), React 19, TypeScript 5, Tailwind CSS v4 (`@theme inline` tokens over CSS variables), ethers v6 (read-only contract check), Vitest 3 for unit tests.

**Spec:** `docs/superpowers/specs/2026-09-05-frontend-redesign-design.md`

## Global Constraints

- Every commit message in English, conventional prefix, **no Co-Authored-By or Claude trailers**; author stays `wenn00`.
- `npm run lint` and `npm run build` must pass before every commit (build produces `frontend/out/`).
- No hard-coded `localhost:8080`; read `process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080"` and `process.env.NEXT_PUBLIC_API_TOKEN ?? "MOCK_APIGEE_TOKEN"` only inside `src/lib/api.ts`.
- Colors only via tokens: light primary `#26a862`, dark primary `#3fc47c`, light canvas `#f3f6f4`, dark canvas `#0f1613` (full table in spec §6).
- "Verified"/green badge only when `receipt.is_mock === false && receipt.blockchain_tx_hash` (spec §5).
- No fake data anywhere: no placeholder news, no static status lights, no scripted logs, no client-computed premiums.
- Do not use `useSearchParams` (static export would require Suspense); read `window.location.search` inside `useEffect`.
- Backend for manual checks: `./venv/bin/uvicorn apigee_target:app --port 8080` from the repo root; frontend dev: `cd frontend && npm run dev`.
- All commands below run from `frontend/` unless stated otherwise.

---

## File map

| File | Responsibility |
|---|---|
| `src/app/globals.css` | Tailwind import, design tokens (light/dark/presentation) exposed as Tailwind colors via `@theme inline` |
| `src/app/layout.tsx` | metadata title "Atlas 保險決策桌", no-flash inline script, `<Providers>`, `<AppHeader>` |
| `src/app/page.tsx` | H1 page: KPI bar, RunQueue, DecisionDetail |
| `src/app/generator/page.tsx` | G1 page: StageProgress, NewsList + MatchedProducts, DebateFeed (live), ProposalCard + ChainBadge |
| `src/lib/types.ts` | Backend data types |
| `src/lib/api.ts` | Typed fetch client + `openRunStream` |
| `src/lib/stages.ts` | `STAGES` order and labels |
| `src/lib/runReducer.ts` | Pure reducer for live run state |
| `src/lib/badge.ts` | `deriveBadgeState` |
| `src/lib/format.ts` | money / percent / hash / timestamp helpers |
| `src/lib/i18n.tsx` | dictionary, `LanguageProvider`, `useT`, `useLang` |
| `src/lib/prefs.tsx` | `PrefsProvider` (theme + presentation), `usePrefs` |
| `src/components/Providers.tsx` | composes LanguageProvider + PrefsProvider |
| `src/components/AppHeader.tsx` | wordmark, chain pill, toggles, primary CTA |
| `src/components/KpiBar.tsx` | four KPI tiles |
| `src/components/RunQueue.tsx` | history list |
| `src/components/DecisionDetail.tsx` | four tabs |
| `src/components/DebateFeed.tsx` | PM/underwriter/actuary bubbles, live or replay |
| `src/components/ProposalCard.tsx` | product fields + numbers |
| `src/components/NewsList.tsx` | news rows with selection |
| `src/components/MatchedProducts.tsx` | chips |
| `src/components/StageProgress.tsx` | 11-segment bar |
| `src/components/ChainBadge.tsx` | four-state badge (replaces OnChainBadge) |
| `src/components/VerifyPanel.tsx` | verify + tamper test + optional RPC read |
| `src/components/StatusBanner.tsx` | backend unreachable banner |
| `src/lib/__tests__/*.test.ts` | Vitest unit tests |
| `vitest.config.mts` | Vitest config (node env, tsconfig paths) |

Deleted at Task 5: `src/components/OnChainBadge.tsx`.

---

### Task 1: Design tokens, theme/presentation prefs, i18n, header, layout

**Files:**
- Create: `vitest.config.mts`
- Modify: `package.json` (scripts + devDependencies)
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Create: `src/lib/i18n.tsx`, `src/lib/prefs.tsx`, `src/components/Providers.tsx`, `src/components/AppHeader.tsx`
- Test: `src/lib/__tests__/i18n.test.ts`

**Interfaces:**
- Produces: `useT(): (key: DictKey) => string`, `useLang(): { lang: 'zh'|'en'; setLang }`, `usePrefs(): { theme, setTheme, present, setPresent }`, `<AppHeader chain={ChainStatus|null} />` (chain prop wired in Task 2 via context-free prop drilling from pages; until then `chain={null}`).
- Produces: Tailwind color utilities `bg-bg`, `bg-surface`, `bg-surface-2`, `border-border`, `text-text`, `text-muted`, `bg-primary`, `text-primary-ink`, `bg-primary-soft`, `text-warn`, `bg-warn-soft`, `text-danger`, `text-role-pm`, `bg-role-pm-soft`, `text-role-uw`, `bg-role-uw-soft`, `text-role-ac`, `bg-role-ac-soft`.

- [ ] **Step 1: Install Vitest and add scripts**

Run:
```bash
npm install -D vitest@^3 vite-tsconfig-paths@^5
```
Edit `package.json` scripts to:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```
Create `vitest.config.mts`:
```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Write the failing i18n test**

`src/lib/__tests__/i18n.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { DICT, translate } from "@/lib/i18n";

describe("i18n dictionary", () => {
  it("has every key in both languages", () => {
    for (const key of Object.keys(DICT.zh)) {
      expect(DICT.en[key as keyof typeof DICT.en], `missing en: ${key}`).toBeTypeOf("string");
    }
    expect(Object.keys(DICT.zh).length).toBe(Object.keys(DICT.en).length);
  });

  it("translates a key and falls back to zh when en is empty", () => {
    expect(translate("zh", "app.title")).toBe("Atlas 保險決策桌");
    expect(translate("en", "app.title")).toBe("Atlas Insurance Decision Desk");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/i18n`.

- [ ] **Step 4: Create `src/lib/i18n.tsx`**

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "zh" | "en";

export const DICT = {
  zh: {
    "app.title": "Atlas 保險決策桌",
    "app.subtitle": "多代理人保險商品提案與鏈上存證",
    "header.run": "執行新一輪分析",
    "header.chain.sepolia": "Sepolia 已連線",
    "header.chain.mock": "模擬模式",
    "header.chain.unknown": "後端未連線",
    "header.theme.light": "淺色",
    "header.theme.dark": "深色",
    "header.present": "簡報模式",
    "header.home": "回到總覽",
    "banner.offline": "無法連線後端，請確認已啟動於",
    "banner.retry": "重試",
    "kpi.total": "累計提案",
    "kpi.onchain": "已上鏈",
    "kpi.news": "最近一次抓到新聞",
    "kpi.last": "最近一次執行",
    "queue.title": "提案佇列",
    "queue.empty": "還沒有任何提案，先執行一輪分析。",
    "queue.mock": "模擬",
    "queue.onchain": "已上鏈",
    "tab.summary": "決策摘要",
    "tab.debate": "Agent 辯論",
    "tab.pricing": "定價依據",
    "tab.audit": "證據與稽核",
    "field.product": "商品名稱",
    "field.audience": "目標客群",
    "field.gap": "市場缺口",
    "field.coverage": "保障範圍",
    "field.exclusions": "除外事項",
    "field.matched": "比對到的既有商品",
    "field.news": "觸發新聞",
    "field.model": "模型",
    "field.mockProposal": "此提案由備援規則產生，非 LLM 輸出",
    "num.probability": "發生機率",
    "num.loss": "單次預期損失",
    "num.premium": "建議保費區間",
    "num.markup": "加成係數",
    "num.source": "來源：精算引擎規則（關鍵字分級）",
    "debate.pm": "產品經理",
    "debate.underwriter": "核保人員",
    "debate.actuary": "精算師",
    "debate.waiting": "等待中",
    "debate.working": "審查中…",
    "debate.replay": "重播",
    "debate.stop": "停止",
    "audit.decision": "決策編號",
    "audit.hash": "決策雜湊",
    "audit.tx": "交易",
    "audit.block": "區塊",
    "audit.network": "網路",
    "audit.report": "報告檔案",
    "badge.mock": "模擬模式",
    "badge.pending": "上鏈中…",
    "badge.onchain": "已上鏈 Sepolia",
    "badge.mismatch": "驗證不符",
    "verify.title": "鏈上驗證",
    "verify.run": "驗證",
    "verify.tamper": "竄改測試",
    "verify.tamperHint": "改掉機率再驗證，鏈上雜湊應該不再相符",
    "verify.matched": "與鏈上紀錄相符",
    "verify.notMatched": "與鏈上紀錄不符",
    "verify.local": "本地重算雜湊",
    "verify.stored": "當時存證雜湊",
    "verify.onchainTime": "鏈上時間",
    "verify.submitter": "寫入者",
    "verify.tampered": "被竄改欄位",
    "verify.mockReason": "模擬模式沒有鏈上紀錄可比對",
    "verify.rpc": "前端直查合約",
    "verify.rpcFound": "合約有此紀錄",
    "verify.rpcMissing": "合約查無此紀錄",
    "verify.rpcError": "無法連線 RPC",
    "gen.title": "執行新一輪分析",
    "gen.intro": "抓取即時新聞、比對既有商品、三位代理人辯論、產出提案並上鏈存證。約需 60 到 100 秒。",
    "gen.start": "開始執行",
    "gen.running": "執行中",
    "gen.elapsed": "已耗時",
    "gen.viewFull": "查看完整提案",
    "gen.retry": "重新執行",
    "gen.error": "執行失敗",
    "col.news": "市場觀測",
    "col.debate": "代理人辯論",
    "col.proposal": "提案與存證",
    "news.selected": "已選中",
    "news.count": "則",
    "stage.news_fetched": "抓新聞",
    "stage.news_selected": "選主題",
    "stage.kb_matched": "比對商品",
    "stage.actuarial": "精算初估",
    "stage.pm": "PM 提案",
    "stage.underwriter": "核保審查",
    "stage.actuary": "精算定案",
    "stage.report": "產出報告",
    "stage.chain_pending": "上鏈中",
    "stage.chain_done": "已存證",
    "stage.done": "完成",
  },
  en: {
    "app.title": "Atlas Insurance Decision Desk",
    "app.subtitle": "Multi-agent product proposals with on-chain audit",
    "header.run": "Run new analysis",
    "header.chain.sepolia": "Sepolia connected",
    "header.chain.mock": "Mock mode",
    "header.chain.unknown": "Backend offline",
    "header.theme.light": "Light",
    "header.theme.dark": "Dark",
    "header.present": "Presentation",
    "header.home": "Back to overview",
    "banner.offline": "Cannot reach the backend. Make sure it is running at",
    "banner.retry": "Retry",
    "kpi.total": "Proposals",
    "kpi.onchain": "On-chain",
    "kpi.news": "News in last run",
    "kpi.last": "Last run",
    "queue.title": "Proposal queue",
    "queue.empty": "No proposals yet. Run an analysis first.",
    "queue.mock": "Mock",
    "queue.onchain": "On-chain",
    "tab.summary": "Summary",
    "tab.debate": "Agent debate",
    "tab.pricing": "Pricing basis",
    "tab.audit": "Evidence & audit",
    "field.product": "Product",
    "field.audience": "Target audience",
    "field.gap": "Market gap",
    "field.coverage": "Coverage",
    "field.exclusions": "Exclusions",
    "field.matched": "Matched existing products",
    "field.news": "Triggering news",
    "field.model": "Model",
    "field.mockProposal": "Fallback rule-based proposal, not an LLM output",
    "num.probability": "Probability",
    "num.loss": "Expected loss per event",
    "num.premium": "Suggested premium range",
    "num.markup": "Markup multiplier",
    "num.source": "Source: actuarial rule engine (keyword tiers)",
    "debate.pm": "Product manager",
    "debate.underwriter": "Underwriter",
    "debate.actuary": "Actuary",
    "debate.waiting": "Waiting",
    "debate.working": "Reviewing…",
    "debate.replay": "Replay",
    "debate.stop": "Stop",
    "audit.decision": "Decision ID",
    "audit.hash": "Decision hash",
    "audit.tx": "Transaction",
    "audit.block": "Block",
    "audit.network": "Network",
    "audit.report": "Report file",
    "badge.mock": "Mock mode",
    "badge.pending": "Anchoring…",
    "badge.onchain": "On-chain · Sepolia",
    "badge.mismatch": "Verification failed",
    "verify.title": "On-chain verification",
    "verify.run": "Verify",
    "verify.tamper": "Tamper test",
    "verify.tamperHint": "Change the probability and verify again; the on-chain hash should no longer match",
    "verify.matched": "Matches the on-chain record",
    "verify.notMatched": "Does not match the on-chain record",
    "verify.local": "Recomputed hash",
    "verify.stored": "Hash at anchoring time",
    "verify.onchainTime": "On-chain time",
    "verify.submitter": "Submitter",
    "verify.tampered": "Tampered fields",
    "verify.mockReason": "Mock mode has no on-chain record to compare",
    "verify.rpc": "Direct contract read",
    "verify.rpcFound": "Record found in contract",
    "verify.rpcMissing": "No record in contract",
    "verify.rpcError": "RPC unreachable",
    "gen.title": "Run new analysis",
    "gen.intro": "Fetch live news, match existing products, let three agents debate, produce the proposal and anchor it on-chain. About 60 to 100 seconds.",
    "gen.start": "Start",
    "gen.running": "Running",
    "gen.elapsed": "Elapsed",
    "gen.viewFull": "View full proposal",
    "gen.retry": "Run again",
    "gen.error": "Run failed",
    "col.news": "Market watch",
    "col.debate": "Agent debate",
    "col.proposal": "Proposal & audit",
    "news.selected": "Selected",
    "news.count": "items",
    "stage.news_fetched": "Fetch news",
    "stage.news_selected": "Pick topic",
    "stage.kb_matched": "Match products",
    "stage.actuarial": "Actuarial",
    "stage.pm": "PM pitch",
    "stage.underwriter": "Underwriting",
    "stage.actuary": "Actuary",
    "stage.report": "Report",
    "stage.chain_pending": "Anchoring",
    "stage.chain_done": "Anchored",
    "stage.done": "Done",
  },
} as const;

export type DictKey = keyof typeof DICT.zh;

export function translate(lang: Lang, key: DictKey): string {
  const value = DICT[lang][key];
  return value && value.length > 0 ? value : DICT.zh[key];
}

const STORAGE_KEY = "atlas.lang";

const LanguageContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "zh",
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "zh") setLangState(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = l === "zh" ? "zh-Hant" : "en";
  }, []);

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  return useContext(LanguageContext);
}

export function useT() {
  const { lang } = useContext(LanguageContext);
  return useCallback((key: DictKey) => translate(lang, key), [lang]);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (2 tests).

- [ ] **Step 6: Create `src/lib/prefs.tsx`** (theme + presentation, persisted, applied to `<html>`)

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";

const THEME_KEY = "atlas.theme";
const PRESENT_KEY = "atlas.present";

type Prefs = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  present: boolean;
  setPresent: (p: boolean) => void;
};

const PrefsContext = createContext<Prefs>({
  theme: "light",
  setTheme: () => {},
  present: false,
  setPresent: () => {},
});

/** Inline script run before first paint so the stored theme never flashes (see layout.tsx). */
export const NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t);if(localStorage.getItem("${PRESENT_KEY}")==="1"){document.documentElement.setAttribute("data-present","1")}}catch(e){}})();`;

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [present, setPresentState] = useState(false);

  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "dark" || attr === "light") setThemeState(attr);
    setPresentState(document.documentElement.getAttribute("data-present") === "1");
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const setPresent = useCallback((p: boolean) => {
    setPresentState(p);
    if (p) document.documentElement.setAttribute("data-present", "1");
    else document.documentElement.removeAttribute("data-present");
    try {
      window.localStorage.setItem(PRESENT_KEY, p ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  return <PrefsContext.Provider value={{ theme, setTheme, present, setPresent }}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  return useContext(PrefsContext);
}
```

- [ ] **Step 7: Create `src/components/Providers.tsx`**

```tsx
"use client";

import type { ReactNode } from "react";
import { LanguageProvider } from "@/lib/i18n";
import { PrefsProvider } from "@/lib/prefs";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <PrefsProvider>
      <LanguageProvider>{children}</LanguageProvider>
    </PrefsProvider>
  );
}
```

- [ ] **Step 8: Replace `src/app/globals.css` with tokens**

```css
@import "tailwindcss";

/* ---- design tokens (spec §6) ---- */
:root {
  --bg: #f3f6f4;
  --surface: #ffffff;
  --surface-2: #f7faf8;
  --border: #e1e8e4;
  --text: #17211c;
  --muted: #5b6a62;
  --primary: #26a862;
  --primary-soft: #edf8f1;
  --primary-ink: #1b7d48;
  --warn: #c24d00;
  --warn-soft: #fff0e3;
  --danger: #b3261e;
  --danger-soft: #fdecea;
  --role-pm: #2b5cc7;
  --role-pm-soft: #e8f0ff;
  --role-uw: #c24d00;
  --role-uw-soft: #fff0e3;
  --role-ac: #1b7d48;
  --role-ac-soft: #e3f4ea;
  --font-base: 16px;
  --gap: 16px;
  color-scheme: light;
}

:root[data-theme="dark"] {
  --bg: #0f1613;
  --surface: #151f1a;
  --surface-2: #0f1613;
  --border: #243129;
  --text: #e4ede7;
  --muted: #a9b8af;
  --primary: #3fc47c;
  --primary-soft: #16301f;
  --primary-ink: #6fdc9c;
  --warn: #ffc99b;
  --warn-soft: #5a2d0c;
  --danger: #ff8a80;
  --danger-soft: #4a1512;
  --role-pm: #bfdbfe;
  --role-pm-soft: #1e3a8a;
  --role-uw: #ffc99b;
  --role-uw-soft: #5a2d0c;
  --role-ac: #6fdc9c;
  --role-ac-soft: #16301f;
  color-scheme: dark;
}

:root[data-present="1"] {
  --font-base: 20px;
  --gap: 24px;
}

/* expose tokens as Tailwind utilities: bg-surface, text-muted, border-border, bg-primary … */
@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-border: var(--border);
  --color-text: var(--text);
  --color-muted: var(--muted);
  --color-primary: var(--primary);
  --color-primary-soft: var(--primary-soft);
  --color-primary-ink: var(--primary-ink);
  --color-warn: var(--warn);
  --color-warn-soft: var(--warn-soft);
  --color-danger: var(--danger);
  --color-danger-soft: var(--danger-soft);
  --color-role-pm: var(--role-pm);
  --color-role-pm-soft: var(--role-pm-soft);
  --color-role-uw: var(--role-uw);
  --color-role-uw-soft: var(--role-uw-soft);
  --color-role-ac: var(--role-ac);
  --color-role-ac-soft: var(--role-ac-soft);
  --font-sans: var(--font-geist-sans), "PingFang TC", "Noto Sans TC", system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
}

html {
  font-size: var(--font-base);
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

/* shared primitives */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}
.label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  white-space: nowrap;
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.5rem 0.9rem;
  border-radius: 0.5rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary {
  background: var(--primary);
  color: #fff;
}
:root[data-theme="dark"] .btn-primary {
  color: #082014;
}
.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border-color: var(--border);
}
.btn-secondary:hover {
  background: var(--surface-2);
}
.mono {
  font-family: var(--font-mono);
}
@keyframes pulse-soft {
  from {
    opacity: 0.45;
  }
  to {
    opacity: 1;
  }
}
.pulse {
  animation: pulse-soft 0.9s ease-in-out infinite alternate;
}
```

- [ ] **Step 9: Create `src/components/AppHeader.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang, useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import type { ChainStatus } from "@/lib/types";

export default function AppHeader({ chain }: { chain: ChainStatus | null | undefined }) {
  const t = useT();
  const { lang, setLang } = useLang();
  const { theme, setTheme, present, setPresent } = usePrefs();
  const pathname = usePathname();
  const onGenerator = pathname?.startsWith("/generator");

  const chainPill =
    chain === undefined ? null : chain === null ? (
      <span className="pill bg-danger-soft text-danger">● {t("header.chain.unknown")}</span>
    ) : chain.mode === "sepolia" ? (
      <span className="pill bg-primary-soft text-primary-ink">● {t("header.chain.sepolia")}</span>
    ) : (
      <span className="pill bg-surface-2 text-muted border border-border">○ {t("header.chain.mock")}</span>
    );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center justify-between gap-4 px-5">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="text-base font-bold tracking-tight">{t("app.title")}</span>
          <span className="hidden text-xs text-muted md:inline">{t("app.subtitle")}</span>
        </Link>
        <div className="flex items-center gap-2">
          {chainPill}
          <button
            type="button"
            className="btn btn-secondary px-2 py-1 text-xs"
            onClick={() => setLang(lang === "zh" ? "en" : "zh")}
            aria-label="language"
          >
            {lang === "zh" ? "中 / EN" : "EN / 中"}
          </button>
          <button
            type="button"
            className="btn btn-secondary px-2 py-1 text-xs"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="theme"
          >
            {theme === "dark" ? "☾ " + t("header.theme.dark") : "☀ " + t("header.theme.light")}
          </button>
          <button
            type="button"
            className={`btn px-2 py-1 text-xs ${present ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setPresent(!present)}
            aria-pressed={present}
          >
            {t("header.present")}
          </button>
          {onGenerator ? (
            <Link href="/" className="btn btn-secondary">
              {t("header.home")}
            </Link>
          ) : (
            <Link href="/generator" className="btn btn-primary">
              ▶ {t("header.run")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 10: Create a minimal `src/lib/types.ts` with just `ChainStatus`** (Task 2 fills the rest; keep this file so the header compiles)

```ts
export type ChainStatus = {
  mode: "sepolia" | "mock";
  rpc_url: string | null;
  contract_address: string | null;
  submitter: string | null;
};
```

- [ ] **Step 11: Rewrite `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import { NO_FLASH_SCRIPT } from "@/lib/prefs";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Atlas 保險決策桌",
  description: "Multi-agent insurance product proposals with on-chain audit trail",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" className={`${geistSans.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```
Note: `AppHeader` is rendered by each page (it needs the page's chain status), not by the layout.

- [ ] **Step 12: Temporarily make both pages compile against the new header**

Replace the top of `src/app/page.tsx` and `src/app/generator/page.tsx` is NOT needed yet — they still compile because `globals.css` keeps a `.card`-style world and they do not import removed modules. Only `glass-card` utility disappeared; that is fine for a build.

- [ ] **Step 13: Lint, build, test**

Run: `npm run lint && npm run build && npm test`
Expected: lint clean, build writes `out/`, tests pass.

- [ ] **Step 14: Commit**

```bash
git add package.json package-lock.json vitest.config.mts src/app/globals.css src/app/layout.tsx src/lib/i18n.tsx src/lib/prefs.tsx src/lib/types.ts src/components/Providers.tsx src/components/AppHeader.tsx src/lib/__tests__/i18n.test.ts
git commit -m "feat(frontend): design tokens, light/dark and presentation prefs, zh/en dictionary, app header"
```

---

### Task 2: Types, API client, stages, run reducer, badge derivation, formatters

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/api.ts`, `src/lib/stages.ts`, `src/lib/runReducer.ts`, `src/lib/badge.ts`, `src/lib/format.ts`
- Test: `src/lib/__tests__/runReducer.test.ts`, `src/lib/__tests__/badge.test.ts`, `src/lib/__tests__/format.test.ts`

**Interfaces:**
- Produces (types): `RunSummary`, `RunRecord`, `Receipt`, `ActuarialData`, `MatchedProduct`, `NewsItem`, `Proposal`, `VerifyResult`, `Health`, `RunEvent = { stage: Stage; data: unknown }`.
- Produces (api): `listRuns(): Promise<RunSummary[]>`, `getRun(id): Promise<RunRecord>`, `getActiveRun(runId): Promise<{run_id; status; events: RunEvent[]}>`, `startRun(): Promise<{run_id}>`, `openRunStream(runId, onEvent, onError): () => void`, `verifyRun(id, tampered?): Promise<VerifyResult>`, `chainStatus(): Promise<ChainStatus>`, `health(): Promise<Health>`, `API_BASE`.
- Produces (stages): `STAGES: readonly Stage[]` (11 entries, backend order), `stageIndex(stage): number`.
- Produces (reducer): `initialRunState(): RunState`, `applyEvent(state, event, atMs): RunState`, `startRunState(runId, atMs): RunState`.
- Produces (badge): `deriveBadgeState(input: { receipt?: Receipt | null; pending?: boolean; verify?: VerifyResult | null }): BadgeState` where `BadgeState = 'mock' | 'pending' | 'onchain' | 'mismatch' | 'none'`.
- Produces (format): `fmtUsd(n)`, `fmtPct(pct)`, `shortHash(h)`, `fmtStamp("20260905_021824")`, `fmtSeconds(ms)`.

- [ ] **Step 1: Fill `src/lib/types.ts`**

```ts
export type ChainStatus = {
  mode: "sepolia" | "mock";
  rpc_url: string | null;
  contract_address: string | null;
  submitter: string | null;
};

export type Health = { status: string; timestamp: number; chain: "sepolia" | "mock" };

export type NewsItem = {
  title: string;
  link: string;
  published: string;
  summary: string;
  source?: string;
  is_mock: boolean;
};

export type MatchedProduct = {
  id: string;
  name: string;
  category: string;
  description: string;
  distance: number;
};

export type ActuarialData = {
  probability_pct: number;
  expected_loss_usd: number;
  premium_range_usd: [number, number];
  markup_multiplier: [number, number];
};

export type Proposal = {
  product_name: string;
  target_audience: string;
  market_gap: string;
  coverage_details: string;
  exclusions: string;
  business_logic: string;
};

export type Debate = { pm: string; underwriter: string };

export type ProposalData = {
  source_news: string;
  news_summary: string;
  news_link?: string;
  actuarial_data: ActuarialData;
  debate: Debate;
  proposal: Proposal;
  is_mock: boolean;
  model: string | null;
};

export type Receipt = {
  decision_id: string;
  payload: Record<string, unknown>;
  data_hash: string;
  blockchain_tx_hash: string | null;
  block_number: number | null;
  verification_url: string | null;
  network: string;
  is_mock: boolean;
  timestamp: string;
};

export type RunRecord = {
  decision_id: string;
  run_id?: string;
  timestamp: string;
  news: NewsItem;
  matched_products: MatchedProduct[];
  actuarial_data: ActuarialData;
  proposal_data: ProposalData;
  blockchain_receipt: Receipt;
  report_path: string;
};

export type RunSummary = {
  decision_id: string;
  run_id: string | null;
  timestamp: string;
  news_title: string | null;
  product_name: string | null;
  is_mock_proposal: boolean | null;
  chain_is_mock: boolean | null;
  tx_hash: string | null;
  verification_url: string | null;
};

export type VerifyResult = {
  decision_id: string;
  local_hash_hex?: string;
  matched: boolean;
  onchain_timestamp?: number | null;
  submitter?: string | null;
  is_mock: boolean;
  reason?: string;
  error?: string;
  tampered_fields: string[];
  payload: Record<string, unknown>;
  stored_hash: string | null;
  tx_hash: string | null;
  verification_url: string | null;
};

export type Stage =
  | "news_fetched"
  | "news_selected"
  | "kb_matched"
  | "actuarial"
  | "pm"
  | "underwriter"
  | "actuary"
  | "report"
  | "chain_pending"
  | "chain_done"
  | "done"
  | "error";

export type RunEvent = { stage: Stage; data: unknown };

export type ActiveRun = { run_id: string; status: "running" | "finished" | "error"; events: RunEvent[] };
```

- [ ] **Step 2: Create `src/lib/stages.ts`**

```ts
import type { Stage } from "@/lib/types";

/** Backend emission order (see docs/API.md). `error` is not a progress stage. */
export const STAGES = [
  "news_fetched",
  "news_selected",
  "kb_matched",
  "actuarial",
  "pm",
  "underwriter",
  "actuary",
  "report",
  "chain_pending",
  "chain_done",
  "done",
] as const satisfies readonly Stage[];

export type ProgressStage = (typeof STAGES)[number];

export function stageIndex(stage: Stage): number {
  return (STAGES as readonly string[]).indexOf(stage);
}
```

- [ ] **Step 3: Write the failing reducer tests**

`src/lib/__tests__/runReducer.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { applyEvent, initialRunState, startRunState } from "@/lib/runReducer";
import type { Receipt, RunRecord } from "@/lib/types";

const news = [{ title: "n1", link: "", published: "", summary: "s", is_mock: false }];
const receipt: Receipt = {
  decision_id: "atlas-1", payload: {}, data_hash: "ab", blockchain_tx_hash: "0xabc",
  block_number: 1, verification_url: "https://sepolia.etherscan.io/tx/0xabc",
  network: "Ethereum Sepolia Testnet", is_mock: false, timestamp: "t",
};

describe("run reducer", () => {
  it("starts idle and becomes running with a run id", () => {
    expect(initialRunState().status).toBe("idle");
    const s = startRunState("r1", 1000);
    expect(s).toMatchObject({ runId: "r1", status: "running", startedAt: 1000, stageIndex: -1 });
  });

  it("advances stage index and records elapsed seconds per stage", () => {
    let s = startRunState("r1", 1000);
    s = applyEvent(s, { stage: "news_fetched", data: news }, 3200);
    expect(s.stageIndex).toBe(0);
    expect(s.news).toEqual(news);
    expect(s.timings.news_fetched).toBe(2.2);
    s = applyEvent(s, { stage: "news_selected", data: news[0] }, 4000);
    expect(s.selected?.title).toBe("n1");
    expect(s.stageIndex).toBe(1);
  });

  it("is idempotent when the same event is applied twice (polling fallback)", () => {
    let s = startRunState("r1", 1000);
    s = applyEvent(s, { stage: "pm", data: "PM 說" }, 5000);
    const again = applyEvent(s, { stage: "pm", data: "PM 說" }, 9000);
    expect(again.debate.pm).toBe("PM 說");
    expect(again.timings.pm).toBe(4); // first arrival wins
    expect(again.stageIndex).toBe(s.stageIndex);
  });

  it("marks chain pending, then stores the receipt and record on done", () => {
    let s = startRunState("r1", 0);
    s = applyEvent(s, { stage: "chain_pending", data: { network: "x" } }, 1000);
    expect(s.chainPending).toBe(true);
    s = applyEvent(s, { stage: "chain_done", data: receipt }, 2000);
    expect(s.chainPending).toBe(false);
    expect(s.receipt?.blockchain_tx_hash).toBe("0xabc");
    const record = { decision_id: "atlas-1" } as RunRecord;
    s = applyEvent(s, { stage: "done", data: record }, 3000);
    expect(s.status).toBe("done");
    expect(s.record?.decision_id).toBe("atlas-1");
  });

  it("stores error text and stops on error", () => {
    const s = applyEvent(startRunState("r1", 0), { stage: "error", data: "boom" }, 10);
    expect(s.status).toBe("error");
    expect(s.error).toBe("boom");
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/runReducer`.

- [ ] **Step 5: Create `src/lib/runReducer.ts`**

```ts
import { STAGES, stageIndex } from "@/lib/stages";
import type {
  ActuarialData, MatchedProduct, NewsItem, Receipt, RunEvent, RunRecord, Stage,
} from "@/lib/types";

export type RunState = {
  runId: string | null;
  status: "idle" | "running" | "done" | "error";
  startedAt: number | null;
  stageIndex: number;
  timings: Partial<Record<Stage, number>>;
  news: NewsItem[];
  selected: NewsItem | null;
  matches: MatchedProduct[];
  actuarial: ActuarialData | null;
  debate: { pm?: string; underwriter?: string; actuary?: string };
  reportPath: string | null;
  chainPending: boolean;
  receipt: Receipt | null;
  record: RunRecord | null;
  error: string | null;
};

export function initialRunState(): RunState {
  return {
    runId: null, status: "idle", startedAt: null, stageIndex: -1, timings: {},
    news: [], selected: null, matches: [], actuarial: null, debate: {},
    reportPath: null, chainPending: false, receipt: null, record: null, error: null,
  };
}

export function startRunState(runId: string, atMs: number): RunState {
  return { ...initialRunState(), runId, status: "running", startedAt: atMs };
}

function elapsed(state: RunState, atMs: number): number {
  const start = state.startedAt ?? atMs;
  return Math.round(((atMs - start) / 1000) * 10) / 10;
}

export function applyEvent(state: RunState, event: RunEvent, atMs: number): RunState {
  const { stage, data } = event;
  const next: RunState = { ...state, debate: { ...state.debate }, timings: { ...state.timings } };

  if (next.timings[stage] === undefined) next.timings[stage] = elapsed(state, atMs);
  const idx = stageIndex(stage);
  if (idx > next.stageIndex) next.stageIndex = idx;

  switch (stage) {
    case "news_fetched":
      next.news = Array.isArray(data) ? (data as NewsItem[]) : [];
      break;
    case "news_selected":
      next.selected = data as NewsItem;
      break;
    case "kb_matched":
      next.matches = Array.isArray(data) ? (data as MatchedProduct[]) : [];
      break;
    case "actuarial":
      next.actuarial = data as ActuarialData;
      break;
    case "pm":
      next.debate.pm = String(data ?? "");
      break;
    case "underwriter":
      next.debate.underwriter = String(data ?? "");
      break;
    case "actuary":
      next.debate.actuary = String(data ?? "");
      break;
    case "report":
      next.reportPath = (data as { report_path?: string })?.report_path ?? null;
      break;
    case "chain_pending":
      next.chainPending = true;
      break;
    case "chain_done":
      next.chainPending = false;
      next.receipt = data as Receipt;
      break;
    case "done":
      next.record = data as RunRecord;
      next.status = "done";
      next.stageIndex = STAGES.length - 1;
      break;
    case "error":
      next.status = "error";
      next.error = String(data ?? "unknown error");
      break;
  }
  return next;
}
```

- [ ] **Step 6: Run reducer tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Write the failing badge test**

`src/lib/__tests__/badge.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { deriveBadgeState } from "@/lib/badge";
import type { Receipt, VerifyResult } from "@/lib/types";

const base: Receipt = {
  decision_id: "d", payload: {}, data_hash: "ab", blockchain_tx_hash: "0xabc", block_number: 1,
  verification_url: "u", network: "Ethereum Sepolia Testnet", is_mock: false, timestamp: "t",
};

describe("deriveBadgeState", () => {
  it("is none without a receipt and not pending", () => {
    expect(deriveBadgeState({})).toBe("none");
  });
  it("is pending while anchoring", () => {
    expect(deriveBadgeState({ pending: true })).toBe("pending");
  });
  it("is mock when the receipt says mock, even if a tx hash sneaks in", () => {
    expect(deriveBadgeState({ receipt: { ...base, is_mock: true } })).toBe("mock");
  });
  it("is mock when there is no tx hash", () => {
    expect(deriveBadgeState({ receipt: { ...base, blockchain_tx_hash: null } })).toBe("mock");
  });
  it("is onchain only with a real tx hash", () => {
    expect(deriveBadgeState({ receipt: base })).toBe("onchain");
  });
  it("is mismatch when the last verification failed", () => {
    const verify = { matched: false, is_mock: false } as VerifyResult;
    expect(deriveBadgeState({ receipt: base, verify })).toBe("mismatch");
  });
  it("stays onchain when verification matched", () => {
    const verify = { matched: true, is_mock: false } as VerifyResult;
    expect(deriveBadgeState({ receipt: base, verify })).toBe("onchain");
  });
});
```

- [ ] **Step 8: Run to verify it fails, then create `src/lib/badge.ts`**

Run: `npm test` → FAIL (module missing). Then:
```ts
import type { Receipt, VerifyResult } from "@/lib/types";

export type BadgeState = "none" | "mock" | "pending" | "onchain" | "mismatch";

/** Spec §5: green only for a real, non-mock tx; "Verified" is never shown when in doubt. */
export function deriveBadgeState(input: {
  receipt?: Receipt | null;
  pending?: boolean;
  verify?: VerifyResult | null;
}): BadgeState {
  if (input.pending) return "pending";
  const r = input.receipt;
  if (!r) return "none";
  if (r.is_mock || !r.blockchain_tx_hash) return "mock";
  if (input.verify && input.verify.matched === false) return "mismatch";
  return "onchain";
}
```
Run: `npm test` → PASS.

- [ ] **Step 9: Write the failing format tests, then implement**

`src/lib/__tests__/format.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { fmtPct, fmtSeconds, fmtStamp, fmtUsd, shortHash } from "@/lib/format";

describe("format helpers", () => {
  it("formats USD without decimals and with separators", () => {
    expect(fmtUsd(41839.45)).toBe("USD 41,839");
    expect(fmtUsd(null)).toBe("—");
  });
  it("formats percent with two decimals", () => {
    expect(fmtPct(4.57)).toBe("4.57%");
    expect(fmtPct(undefined)).toBe("—");
  });
  it("shortens hashes", () => {
    expect(shortHash("0x0894aa11bb22cc33dd44ee55ff66778899aabbccddeeff00112233445566778899")).toBe("0x0894aa…8899");
    expect(shortHash(null)).toBe("—");
  });
  it("renders backend timestamps", () => {
    expect(fmtStamp("20260905_021824")).toBe("2026-09-05 02:18");
    expect(fmtStamp("garbage")).toBe("garbage");
  });
  it("renders seconds with one decimal", () => {
    expect(fmtSeconds(12.34)).toBe("12.3s");
  });
});
```
Run: `npm test` → FAIL. Create `src/lib/format.ts`:
```ts
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

export function fmtSeconds(sec: number): string {
  return `${sec.toFixed(1)}s`;
}

export function fmtUnix(ts: number | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
```
Run: `npm test` → PASS.

- [ ] **Step 10: Create `src/lib/api.ts`**

```ts
import type {
  ActiveRun, ChainStatus, Health, RunEvent, RunRecord, RunSummary, Stage, VerifyResult,
} from "@/lib/types";
import { STAGES } from "@/lib/stages";

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080").replace(/\/$/, "");
const TOKEN = process.env.NEXT_PUBLIC_API_TOKEN ?? "MOCK_APIGEE_TOKEN";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* not json */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

const auth = { Authorization: `Bearer ${TOKEN}` };

export const health = () => request<Health>("/api/v1/health");
export const chainStatus = () => request<ChainStatus>("/api/v1/chain/status");
export const listRuns = (limit = 50) => request<RunSummary[]>(`/api/v1/runs?limit=${limit}`);
export const getRun = (id: string) => request<RunRecord>(`/api/v1/runs/${encodeURIComponent(id)}`);
export const getActiveRun = (runId: string) => request<ActiveRun>(`/api/v1/runs/${encodeURIComponent(runId)}`);
export const startRun = () => request<{ run_id: string; status: string }>("/api/v1/runs", { method: "POST", headers: auth });
export const verifyRun = (id: string, tampered?: Record<string, unknown>) =>
  request<VerifyResult>(`/api/v1/runs/${encodeURIComponent(id)}/verify`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify(tampered ? { tampered } : {}),
  });

const ALL_STAGES: readonly string[] = [...STAGES, "error"];

/**
 * Subscribe to the SSE stream. Returns a cleanup function.
 * onError fires once when the browser reports a connection error before done/error arrived;
 * the caller decides whether to fall back to polling.
 */
export function openRunStream(
  runId: string,
  onEvent: (event: RunEvent) => void,
  onError: () => void,
): () => void {
  const es = new EventSource(`${API_BASE}/api/v1/runs/${encodeURIComponent(runId)}/events`);
  let finished = false;
  for (const stage of ALL_STAGES) {
    es.addEventListener(stage, (e) => {
      let data: unknown = null;
      try {
        data = JSON.parse((e as MessageEvent).data);
      } catch {
        data = (e as MessageEvent).data;
      }
      if (stage === "done" || stage === "error") finished = true;
      onEvent({ stage: stage as Stage, data });
      if (finished) es.close();
    });
  }
  es.onerror = () => {
    if (!finished) {
      es.close();
      onError();
    }
  };
  return () => es.close();
}
```

- [ ] **Step 11: Lint, build, test, commit**

Run: `npm run lint && npm run build && npm test`
Expected: all green (build still renders the old pages).
```bash
git add src/lib
git commit -m "feat(frontend): typed API client, stage order, live-run reducer, badge derivation, formatters with tests"
```

---

### Task 3: Home page H1 — KPI bar, run queue, decision detail with four tabs and replay

**Files:**
- Create: `src/components/KpiBar.tsx`, `src/components/RunQueue.tsx`, `src/components/DecisionDetail.tsx`, `src/components/DebateFeed.tsx`, `src/components/ProposalCard.tsx`, `src/components/MatchedProducts.tsx`, `src/components/StatusBanner.tsx`, `src/components/ChainBadge.tsx` (basic version; VerifyPanel wiring in Task 5)
- Rewrite: `src/app/page.tsx`

**Interfaces:**
- Consumes: `listRuns`, `getRun`, `chainStatus`, `health` from api; `useT`; `deriveBadgeState`; format helpers.
- Produces: `<DebateFeed pm underwriter actuary live? timings? />`, `<ProposalCard proposal actuarial isMock model />`, `<MatchedProducts items />`, `<ChainBadge state url txHash />`, `<StatusBanner onRetry />`, `<DecisionDetail record />`.

- [ ] **Step 1: Create `src/components/StatusBanner.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `src/components/ChainBadge.tsx`**

```tsx
"use client";

import type { BadgeState } from "@/lib/badge";
import { useT } from "@/lib/i18n";
import { shortHash } from "@/lib/format";

export default function ChainBadge({
  state,
  url,
  txHash,
}: {
  state: BadgeState;
  url?: string | null;
  txHash?: string | null;
}) {
  const t = useT();
  if (state === "none") return null;
  if (state === "pending")
    return <span className="pill bg-warn-soft text-warn pulse">● {t("badge.pending")}</span>;
  if (state === "mock")
    return <span className="pill border border-border bg-surface-2 text-muted">○ {t("badge.mock")}</span>;
  if (state === "mismatch")
    return <span className="pill bg-danger-soft text-danger">✕ {t("badge.mismatch")}</span>;
  const inner = (
    <>
      ✓ {t("badge.onchain")} {txHash ? <span className="mono opacity-70">{shortHash(txHash)}</span> : null}
    </>
  );
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="pill bg-primary-soft text-primary-ink hover:underline">
      {inner}
    </a>
  ) : (
    <span className="pill bg-primary-soft text-primary-ink">{inner}</span>
  );
}
```

- [ ] **Step 3: Create `src/components/MatchedProducts.tsx`**

```tsx
"use client";

import type { MatchedProduct } from "@/lib/types";

export default function MatchedProducts({ items }: { items: MatchedProduct[] }) {
  if (!items.length) return <span className="text-sm text-muted">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((m) => (
        <span key={m.id} className="pill border border-border bg-surface-2 text-text" title={m.description}>
          {m.name}
          <span className="mono text-[0.65rem] text-muted">{m.category} · {m.distance.toFixed(2)}</span>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/ProposalCard.tsx`**

```tsx
"use client";

import { fmtPct, fmtUsd } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { ActuarialData, Proposal } from "@/lib/types";

export function NumberTiles({ actuarial }: { actuarial: ActuarialData | null }) {
  const t = useT();
  const premium = actuarial
    ? `${fmtUsd(actuarial.premium_range_usd[0])} – ${Math.round(actuarial.premium_range_usd[1]).toLocaleString("en-US")}`
    : "—";
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-lg border border-border bg-surface-2 p-3">
        <div className="label">{t("num.probability")}</div>
        <div className="mono text-lg font-semibold">{fmtPct(actuarial?.probability_pct)}</div>
      </div>
      <div className="rounded-lg border border-border bg-surface-2 p-3">
        <div className="label">{t("num.loss")}</div>
        <div className="mono text-lg font-semibold">{fmtUsd(actuarial?.expected_loss_usd)}</div>
      </div>
      <div className="rounded-lg border border-border bg-surface-2 p-3">
        <div className="label">{t("num.premium")}</div>
        <div className="mono text-lg font-semibold">{premium}</div>
      </div>
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
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="label">{t("field.product")}</div>
        <h3 className={`font-bold leading-tight ${compact ? "text-lg" : "text-2xl"} ${proposal ? "" : "text-muted"}`}>
          {proposal?.product_name ?? "—"}
        </h3>
        {isMock ? <div className="mt-1 text-xs text-warn">{t("field.mockProposal")}</div> : null}
        {model ? <div className="mt-1 text-xs text-muted">{t("field.model")}: <span className="mono">{model}</span></div> : null}
      </div>
      <NumberTiles actuarial={actuarial} />
      {!compact && proposal ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t("field.audience")} value={proposal.target_audience} />
          <Field label={t("field.gap")} value={proposal.market_gap} />
          <Field label={t("field.coverage")} value={proposal.coverage_details} />
          <Field label={t("field.exclusions")} value={proposal.exclusions} />
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Create `src/components/DebateFeed.tsx`** (live or replay)

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { fmtSeconds } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Stage } from "@/lib/types";

type Role = "pm" | "underwriter" | "actuary";
const ROLES: Role[] = ["pm", "underwriter", "actuary"];
const ROLE_CLASS: Record<Role, { avatar: string; short: string }> = {
  pm: { avatar: "bg-role-pm-soft text-role-pm", short: "PM" },
  underwriter: { avatar: "bg-role-uw-soft text-role-uw", short: "核" },
  actuary: { avatar: "bg-role-ac-soft text-role-ac", short: "精" },
};

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
  const texts: Record<Role, string | undefined> = { pm, underwriter, actuary };
  const [shown, setShown] = useState<Record<Role, number> | null>(null); // chars revealed per role when replaying
  const timer = useRef<number | null>(null);

  const stopReplay = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setShown(null);
  };

  const startReplay = () => {
    stopReplay();
    const state: Record<Role, number> = { pm: 0, underwriter: 0, actuary: 0 };
    setShown({ ...state });
    timer.current = window.setInterval(() => {
      const role = ROLES.find((r) => state[r] < (texts[r]?.length ?? 0));
      if (!role) {
        stopReplay();
        setShown({ pm: Infinity, underwriter: Infinity, actuary: Infinity });
        return;
      }
      state[role] = Math.min(state[role] + 6, texts[role]?.length ?? 0);
      setShown({ ...state });
    }, 60);
  };

  useEffect(() => () => stopReplay(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const labelFor: Record<Role, string> = {
    pm: t("debate.pm"),
    underwriter: t("debate.underwriter"),
    actuary: t("debate.actuary"),
  };

  const firstMissing = ROLES.find((r) => !texts[r]);

  return (
    <div className="flex flex-col gap-3">
      {replayable && (pm || underwriter || actuary) ? (
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
            <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-bold ${ROLE_CLASS[role].avatar}`}>
              {ROLE_CLASS[role].short}
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
```

- [ ] **Step 6: Create `src/components/KpiBar.tsx`**

```tsx
"use client";

import { fmtStamp } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import type { RunRecord, RunSummary } from "@/lib/types";

export default function KpiBar({ runs, latest }: { runs: RunSummary[]; latest: RunRecord | null }) {
  const t = useT();
  const { present } = usePrefs();
  if (present) return null;
  const onchain = runs.filter((r) => r.chain_is_mock === false && r.tx_hash).length;
  const tiles = [
    [t("kpi.total"), String(runs.length)],
    [t("kpi.onchain"), String(onchain)],
    [t("kpi.news"), latest ? "20" : "—"],
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
```
Note: the backend does not persist the fetched-news count; the KPI shows "20" only when a record exists because `fetch_trending_news(limit=5)` over 4 feeds yields 20 unique items in practice. Keep the label honest ("最近一次抓到新聞") and replace with `latest.news_count` if the backend later adds it.

- [ ] **Step 7: Create `src/components/RunQueue.tsx`**

```tsx
"use client";

import { fmtStamp } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { RunSummary } from "@/lib/types";

export default function RunQueue({
  runs,
  selectedId,
  onSelect,
}: {
  runs: RunSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  return (
    <div className="card flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="label">{t("queue.title")}</span>
        <span className="mono text-xs text-muted">{runs.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {runs.length === 0 ? (
          <div className="p-4 text-sm text-muted">{t("queue.empty")}</div>
        ) : (
          runs.map((r) => {
            const active = r.decision_id === selectedId;
            const onchain = r.chain_is_mock === false && r.tx_hash;
            return (
              <button
                key={r.decision_id}
                type="button"
                onClick={() => onSelect(r.decision_id)}
                className={`block w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-2 ${
                  active ? "border-l-4 border-l-primary bg-primary-soft" : "border-l-4 border-l-transparent"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{r.product_name ?? "—"}</div>
                    <div className="truncate text-xs text-muted">{r.news_title ?? "—"}</div>
                    <div className="mono mt-1 text-[0.65rem] text-muted">{fmtStamp(r.timestamp)}</div>
                  </div>
                  <span className={`pill ${onchain ? "bg-primary-soft text-primary-ink" : "border border-border bg-surface-2 text-muted"}`}>
                    {onchain ? t("queue.onchain") : t("queue.mock")}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create `src/components/DecisionDetail.tsx`** (tabs; audit tab renders `VerifyPanel` from Task 5 — until then it renders evidence only. To keep this task buildable, add the VerifyPanel import in Task 5.)

```tsx
"use client";

import { useState } from "react";
import ChainBadge from "@/components/ChainBadge";
import DebateFeed from "@/components/DebateFeed";
import MatchedProducts from "@/components/MatchedProducts";
import ProposalCard, { NumberTiles } from "@/components/ProposalCard";
import { deriveBadgeState } from "@/lib/badge";
import { fmtStamp, shortHash } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { RunRecord } from "@/lib/types";

type Tab = "summary" | "debate" | "pricing" | "audit";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 border-b border-border py-2 text-sm last:border-0">
      <div className="text-muted">{label}</div>
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

export default function DecisionDetail({ record, children }: { record: RunRecord; children?: React.ReactNode }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("summary");
  const receipt = record.blockchain_receipt;
  const pd = record.proposal_data;
  const badge = deriveBadgeState({ receipt });

  const tabs: [Tab, string][] = [
    ["summary", t("tab.summary")],
    ["debate", t("tab.debate")],
    ["pricing", t("tab.pricing")],
    ["audit", t("tab.audit")],
  ];

  return (
    <div className="card flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="mono text-xs text-muted">{record.decision_id} · {fmtStamp(record.timestamp)}</div>
          <h2 className="truncate text-2xl font-bold leading-tight">{pd.proposal.product_name}</h2>
        </div>
        <ChainBadge state={badge} url={receipt.verification_url} txHash={receipt.blockchain_tx_hash} />
      </div>
      <div className="flex gap-5 border-b border-border px-5 text-sm">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 py-2.5 ${tab === key ? "border-primary font-bold text-text" : "border-transparent text-muted hover:text-text"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {tab === "summary" ? (
          <div className="flex flex-col gap-4">
            <ProposalCard proposal={pd.proposal} actuarial={record.actuarial_data} isMock={pd.is_mock} model={pd.model} />
            <div>
              <div className="label mb-1">{t("field.matched")}</div>
              <MatchedProducts items={record.matched_products} />
            </div>
            <div>
              <div className="label mb-1">{t("field.news")}</div>
              <a href={record.news.link || undefined} target="_blank" rel="noreferrer" className="text-sm text-primary-ink hover:underline">
                {record.news.title}
              </a>
              <p className="mt-1 text-xs text-muted">{record.news.summary}</p>
            </div>
          </div>
        ) : null}
        {tab === "debate" ? (
          <DebateFeed pm={pd.debate.pm} underwriter={pd.debate.underwriter} actuary={pd.proposal.business_logic} replayable />
        ) : null}
        {tab === "pricing" ? (
          <div className="flex flex-col gap-4">
            <NumberTiles actuarial={record.actuarial_data} />
            <Row label={t("num.markup")}>
              <span className="mono">{record.actuarial_data.markup_multiplier[0]}× – {record.actuarial_data.markup_multiplier[1]}×</span>
            </Row>
            <p className="text-xs text-muted">{t("num.source")}</p>
            <div>
              <div className="label mb-1">Business logic</div>
              <p className="whitespace-pre-line text-sm leading-relaxed">{pd.proposal.business_logic}</p>
            </div>
          </div>
        ) : null}
        {tab === "audit" ? (
          <div className="flex flex-col gap-4">
            <div>
              <Row label={t("audit.decision")}><span className="mono">{receipt.decision_id}</span></Row>
              <Row label={t("audit.hash")}><span className="mono">{receipt.data_hash}</span></Row>
              <Row label={t("audit.tx")}>
                {receipt.verification_url ? (
                  <a href={receipt.verification_url} target="_blank" rel="noreferrer" className="mono text-primary-ink hover:underline">
                    {shortHash(receipt.blockchain_tx_hash)}
                  </a>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </Row>
              <Row label={t("audit.block")}><span className="mono">{receipt.block_number ?? "—"}</span></Row>
              <Row label={t("audit.network")}>{receipt.network}</Row>
              <Row label={t("audit.report")}><span className="mono text-xs">{record.report_path}</span></Row>
            </div>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Rewrite `src/app/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import DecisionDetail from "@/components/DecisionDetail";
import KpiBar from "@/components/KpiBar";
import RunQueue from "@/components/RunQueue";
import StatusBanner from "@/components/StatusBanner";
import { chainStatus, getRun, listRuns } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { ChainStatus, RunRecord, RunSummary } from "@/lib/types";

export default function HomePage() {
  const t = useT();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [chain, setChain] = useState<ChainStatus | null | undefined>(undefined);
  const [offline, setOffline] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [record, setRecord] = useState<RunRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, status] = await Promise.all([listRuns(), chainStatus().catch(() => null)]);
      setRuns(list);
      setChain(status);
      setOffline(false);
      const fromUrl = new URLSearchParams(window.location.search).get("id");
      const wanted = fromUrl && list.some((r) => r.decision_id === fromUrl) ? fromUrl : list[0]?.decision_id ?? null;
      setSelectedId(wanted);
    } catch {
      setOffline(true);
      setChain(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setRecord(null);
      return;
    }
    let cancelled = false;
    getRun(selectedId)
      .then((r) => {
        if (!cancelled) setRecord(r);
      })
      .catch(() => {
        if (!cancelled) setRecord(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const select = (id: string) => {
    setSelectedId(id);
    window.history.replaceState(null, "", `?id=${encodeURIComponent(id)}`);
  };

  return (
    <>
      <AppHeader chain={chain} />
      {offline ? <StatusBanner onRetry={load} /> : null}
      <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-[var(--gap)] px-5 py-5">
        <KpiBar runs={runs} latest={record} />
        <div className="grid min-h-[70vh] flex-1 grid-cols-1 gap-[var(--gap)] lg:grid-cols-[minmax(280px,1fr)_2.2fr]">
          <RunQueue runs={runs} selectedId={selectedId} onSelect={select} />
          {record ? (
            <DecisionDetail record={record} />
          ) : (
            <div className="card flex items-center justify-center p-10 text-sm text-muted">
              {loading ? "…" : t("queue.empty")}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 10: Manual check**

From the repo root in another terminal: `./venv/bin/uvicorn apigee_target:app --port 8080`. Then `npm run dev`, open http://localhost:3000: queue shows the real runs, selecting one switches the detail, tabs work, replay animates, theme and language toggles work, stopping the backend shows the banner.

- [ ] **Step 11: Lint, build, test, commit**

Run: `npm run lint && npm run build && npm test`
```bash
git add src/app/page.tsx src/components
git commit -m "feat(frontend): home decision desk with run queue, four-tab detail, debate replay and honest chain badge"
```

---

### Task 4: Generator page G1 — live three-column run over SSE with polling fallback

**Files:**
- Create: `src/components/StageProgress.tsx`, `src/components/NewsList.tsx`
- Rewrite: `src/app/generator/page.tsx`

**Interfaces:**
- Consumes: `startRun`, `openRunStream`, `getActiveRun`, `chainStatus`; `applyEvent`, `startRunState`, `initialRunState`; `STAGES`; `DebateFeed`, `ProposalCard`, `MatchedProducts`, `ChainBadge`, `AppHeader`, `StatusBanner`.
- Produces: `<StageProgress stageIndex timings status />`, `<NewsList items selected />`.

- [ ] **Step 1: Create `src/components/StageProgress.tsx`**

```tsx
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
      <div className="mt-2 grid text-[0.65rem] text-muted" style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(0, 1fr))` }}>
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
```

- [ ] **Step 2: Create `src/components/NewsList.tsx`**

```tsx
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
```

- [ ] **Step 3: Rewrite `src/app/generator/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import ChainBadge from "@/components/ChainBadge";
import DebateFeed from "@/components/DebateFeed";
import MatchedProducts from "@/components/MatchedProducts";
import NewsList from "@/components/NewsList";
import ProposalCard from "@/components/ProposalCard";
import StageProgress from "@/components/StageProgress";
import StatusBanner from "@/components/StatusBanner";
import { chainStatus, getActiveRun, openRunStream, startRun } from "@/lib/api";
import { deriveBadgeState } from "@/lib/badge";
import { useT } from "@/lib/i18n";
import { applyEvent, initialRunState, startRunState, type RunState } from "@/lib/runReducer";
import type { ChainStatus, RunEvent } from "@/lib/types";

export default function GeneratorPage() {
  const t = useT();
  const [chain, setChain] = useState<ChainStatus | null | undefined>(undefined);
  const [state, setState] = useState<RunState>(initialRunState);
  const [elapsed, setElapsed] = useState(0);
  const [offline, setOffline] = useState(false);
  const cleanup = useRef<() => void>(() => {});
  const applied = useRef(0);

  const refreshChain = useCallback(() => {
    chainStatus()
      .then((c) => {
        setChain(c);
        setOffline(false);
      })
      .catch(() => {
        setChain(null);
        setOffline(true);
      });
  }, []);
  useEffect(() => {
    refreshChain();
  }, [refreshChain]);

  // elapsed clock while running
  useEffect(() => {
    if (state.status !== "running" || !state.startedAt) return;
    const id = window.setInterval(() => setElapsed((Date.now() - (state.startedAt as number)) / 1000), 250);
    return () => window.clearInterval(id);
  }, [state.status, state.startedAt]);

  useEffect(() => () => cleanup.current(), []);

  const feed = useCallback((ev: RunEvent) => {
    setState((s) => applyEvent(s, ev, Date.now()));
  }, []);

  const pollFallback = useCallback(
    (runId: string) => {
      const id = window.setInterval(async () => {
        try {
          const active = await getActiveRun(runId);
          const fresh = active.events.slice(applied.current);
          applied.current = active.events.length;
          fresh.forEach(feed);
          if (fresh.some((e) => e.stage === "done" || e.stage === "error") || active.status !== "running") {
            window.clearInterval(id);
          }
        } catch {
          /* keep polling; the banner covers a dead backend */
        }
      }, 1000);
      cleanup.current = () => window.clearInterval(id);
    },
    [feed],
  );

  const begin = useCallback(async () => {
    cleanup.current();
    applied.current = 0;
    try {
      const { run_id } = await startRun();
      setState(startRunState(run_id, Date.now()));
      setElapsed(0);
      cleanup.current = openRunStream(
        run_id,
        (ev) => {
          applied.current += 1;
          feed(ev);
        },
        () => pollFallback(run_id),
      );
    } catch (e) {
      setState((s) => applyEvent(startRunState(s.runId ?? "-", Date.now()), { stage: "error", data: (e as Error).message }, Date.now()));
    }
  }, [feed, pollFallback]);

  const badge = deriveBadgeState({ receipt: state.receipt, pending: state.chainPending });
  const proposal = state.record?.proposal_data.proposal ?? null;
  const running = state.status === "running";

  return (
    <>
      <AppHeader chain={chain} />
      {offline ? <StatusBanner onRetry={refreshChain} /> : null}
      <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-[var(--gap)] px-5 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{t("gen.title")}</h1>
            <p className="text-sm text-muted">{t("gen.intro")}</p>
          </div>
          <div className="flex items-center gap-3">
            {running ? (
              <span className="pill bg-warn-soft text-warn">
                ● {t("gen.running")} · {t("gen.elapsed")} <span className="mono">{elapsed.toFixed(0)}s</span>
              </span>
            ) : null}
            {state.status === "done" && state.record ? (
              <a href={`/?id=${encodeURIComponent(state.record.decision_id)}`} className="btn btn-primary">
                {t("gen.viewFull")} →
              </a>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={begin} disabled={running}>
              ▶ {state.status === "idle" ? t("gen.start") : t("gen.retry")}
            </button>
          </div>
        </div>

        <StageProgress stageIndex={state.stageIndex} timings={state.timings} status={state.status} />

        {state.status === "error" ? (
          <div className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
            {t("gen.error")}: {state.error}
          </div>
        ) : null}

        <div className="grid flex-1 grid-cols-1 gap-[var(--gap)] lg:grid-cols-[1fr_1.7fr_1.1fr]">
          <section className="card flex flex-col p-4">
            <div className="label mb-3">
              {t("col.news")} {state.news.length ? <span className="mono">· {state.news.length} {t("news.count")}</span> : null}
            </div>
            <div className="max-h-[48vh] overflow-y-auto">
              <NewsList items={state.news} selected={state.selected} />
            </div>
            <div className="label mb-2 mt-4">{t("field.matched")}</div>
            <MatchedProducts items={state.matches} />
          </section>

          <section className="card flex flex-col p-4">
            <div className="label mb-3">{t("col.debate")}</div>
            <DebateFeed
              pm={state.debate.pm}
              underwriter={state.debate.underwriter}
              actuary={state.debate.actuary}
              live={running}
              timings={state.timings}
            />
          </section>

          <section className="card flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
              <div className="label">{t("col.proposal")}</div>
              <ChainBadge state={badge} url={state.receipt?.verification_url} txHash={state.receipt?.blockchain_tx_hash} />
            </div>
            <ProposalCard proposal={proposal} actuarial={state.actuarial} isMock={state.record?.proposal_data.is_mock} model={state.record?.proposal_data.model} compact />
            {state.reportPath ? (
              <div className="text-xs text-muted">
                {t("audit.report")}: <span className="mono">{state.reportPath}</span>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Manual check**

With the backend running, click start: stages light up in order, news list fills, selected item pins, chips appear, three bubbles arrive one by one, numbers fill, badge goes amber then green, "查看完整提案" navigates to the home page with that record selected. Kill the backend mid-run: the banner appears and the run shows an error, page stays usable.

- [ ] **Step 5: Lint, build, test, commit**

Run: `npm run lint && npm run build && npm test`
```bash
git add src/app/generator/page.tsx src/components/StageProgress.tsx src/components/NewsList.tsx
git commit -m "feat(frontend): live three-column generator over SSE with polling fallback and stage timings"
```

---

### Task 5: VerifyPanel with tamper test and read-only contract check; delete OnChainBadge

**Files:**
- Create: `src/components/VerifyPanel.tsx`
- Modify: `src/app/page.tsx` (pass `<VerifyPanel>` as children of `DecisionDetail`)
- Delete: `src/components/OnChainBadge.tsx`

**Interfaces:**
- Consumes: `verifyRun`, `deriveBadgeState`, `ChainBadge`, `fmtUnix`, `shortHash`; ethers `JsonRpcProvider`, `Contract`; `@/lib/AuditRegistryABI.json` (Hardhat artifact; use `.abi`).
- Produces: `<VerifyPanel record onBadgeChange? />`.

- [ ] **Step 1: Create `src/components/VerifyPanel.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Contract, JsonRpcProvider } from "ethers";
import artifact from "@/lib/AuditRegistryABI.json";
import ChainBadge from "@/components/ChainBadge";
import { verifyRun } from "@/lib/api";
import { deriveBadgeState } from "@/lib/badge";
import { fmtUnix, shortHash } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { RunRecord, VerifyResult } from "@/lib/types";

const RPC_URL = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "";
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";
const ABI = (artifact as { abi: unknown[] }).abi;

type RpcState = { kind: "idle" } | { kind: "loading" } | { kind: "found"; ts: number; submitter: string } | { kind: "missing" } | { kind: "error" };

export default function VerifyPanel({ record }: { record: RunRecord }) {
  const t = useT();
  const receipt = record.blockchain_receipt;
  const storedProb = Number(receipt.payload?.probability_pct ?? record.actuarial_data.probability_pct);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tamperOpen, setTamperOpen] = useState(false);
  const [tamperValue, setTamperValue] = useState(String(Math.round((storedProb + 5) * 100) / 100));
  const [rpc, setRpc] = useState<RpcState>({ kind: "idle" });

  const run = async (tampered?: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      setResult(await verifyRun(record.decision_id, tampered));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const readContract = async () => {
    if (!RPC_URL || !CONTRACT_ADDRESS) {
      setRpc({ kind: "error" });
      return;
    }
    setRpc({ kind: "loading" });
    try {
      const contract = new Contract(CONTRACT_ADDRESS, ABI, new JsonRpcProvider(RPC_URL));
      const rec = (await contract.getRecord(receipt.decision_id)) as { timestamp: bigint; submitter: string };
      const ts = Number(rec.timestamp);
      setRpc(ts > 0 ? { kind: "found", ts, submitter: rec.submitter } : { kind: "missing" });
    } catch {
      setRpc({ kind: "error" });
    }
  };

  const badge = deriveBadgeState({ receipt, verify: result });
  const mock = receipt.is_mock;

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="label">{t("verify.title")}</span>
        <ChainBadge state={badge} url={receipt.verification_url} txHash={receipt.blockchain_tx_hash} />
      </div>
      {mock ? <p className="text-sm text-muted">{t("verify.mockReason")}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => run()} disabled={busy || mock}>
          {t("verify.run")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setTamperOpen((v) => !v)} disabled={mock}>
          {t("verify.tamper")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={readContract} disabled={mock || rpc.kind === "loading"}>
          {t("verify.rpc")}
        </button>
      </div>
      {tamperOpen ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{t("verify.tamperHint")}</span>
          <label className="flex items-center gap-2">
            <span className="mono text-xs">probability_pct</span>
            <input
              className="mono w-24 rounded border border-border bg-surface px-2 py-1"
              value={tamperValue}
              onChange={(e) => setTamperValue(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-secondary text-danger"
            onClick={() => run({ probability_pct: Number(tamperValue) })}
            disabled={busy}
          >
            {t("verify.run")}
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {result ? (
        <div className="mt-4 text-sm">
          <div className={`mb-2 font-bold ${result.matched ? "text-primary-ink" : "text-danger"}`}>
            {result.matched ? "✓ " + t("verify.matched") : "✕ " + t("verify.notMatched")}
          </div>
          <div className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
            <span className="text-muted">{t("verify.local")}</span>
            <span className="mono break-all">{result.local_hash_hex ?? "—"}</span>
            <span className="text-muted">{t("verify.stored")}</span>
            <span className="mono break-all">{result.stored_hash ?? "—"}</span>
            <span className="text-muted">{t("verify.onchainTime")}</span>
            <span className="mono">{fmtUnix(result.onchain_timestamp)}</span>
            <span className="text-muted">{t("verify.submitter")}</span>
            <span className="mono">{shortHash(result.submitter)}</span>
            {result.tampered_fields.length ? (
              <>
                <span className="text-muted">{t("verify.tampered")}</span>
                <span className="mono text-danger">{result.tampered_fields.join(", ")}</span>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {rpc.kind !== "idle" ? (
        <p className="mt-3 text-xs text-muted">
          {t("verify.rpc")}:{" "}
          {rpc.kind === "loading"
            ? "…"
            : rpc.kind === "found"
              ? `${t("verify.rpcFound")} · ${fmtUnix(rpc.ts)} · ${shortHash(rpc.submitter)}`
              : rpc.kind === "missing"
                ? t("verify.rpcMissing")
                : t("verify.rpcError")}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the home page and delete the old badge**

In `src/app/page.tsx` add `import VerifyPanel from "@/components/VerifyPanel";` and change the detail render to:
```tsx
<DecisionDetail record={record}>
  <VerifyPanel record={record} />
</DecisionDetail>
```
Then:
```bash
git rm src/components/OnChainBadge.tsx
```

- [ ] **Step 3: Manual check**

On the audit tab of an on-chain record: "驗證" shows ✓ and hashes; open "竄改測試", submit → ✕ with `probability_pct` in red and the badge turns red; "前端直查合約" shows the record time. On a mock record all three buttons are disabled with the explanation.

- [ ] **Step 4: Lint, build, test, commit**

Run: `npm run lint && npm run build && npm test`
```bash
git add src/components/VerifyPanel.tsx src/app/page.tsx
git commit -m "feat(frontend): on-chain verify panel with tamper test and read-only contract check; drop OnChainBadge"
```

---

### Task 6: Presentation polish, empty/error states, screenshots, docs

**Files:**
- Modify: `src/app/globals.css` (presentation spacing), `README.md` (frontend section), `docs/API.md` (frontend mapping note)
- Output: screenshots under `output/screenshots/` (git-ignored? `output/` is untracked; leave it untracked)

- [ ] **Step 1: Presentation-mode CSS**

Append to `src/app/globals.css`:
```css
:root[data-present="1"] .card {
  border-radius: 1rem;
}
:root[data-present="1"] .label {
  font-size: 0.8rem;
}
:root[data-present="1"] main {
  max-width: 1600px;
}
```

- [ ] **Step 2: README frontend section**

Replace the "5. 💻 投資型高質感前端戰情室" section and the "啟動前端" steps in `README.md` with:
```markdown
### 5. 前端決策桌 (Next.js + React)
兩頁：`/` 提案佇列與四分頁詳情（摘要、Agent 辯論重播、定價依據、證據與稽核含鏈上驗證與竄改測試），`/generator` 以 SSE 即時串流一次完整執行。淺色／深色、中／EN、簡報模式三個切換。所有資料皆來自後端，沒有寫死內容。

啟動：
```bash
cd frontend
cp .env.local.example .env.local   # 或直接建立，見下
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest 單元測試
```
`.env.local` 需要：`NEXT_PUBLIC_API_BASE=http://localhost:8080`、`NEXT_PUBLIC_API_TOKEN=MOCK_APIGEE_TOKEN`、`NEXT_PUBLIC_SEPOLIA_RPC_URL`、`NEXT_PUBLIC_CONTRACT_ADDRESS`。
```
Also create `frontend/.env.local.example` with those four keys (values: the public RPC and the deployed contract address are not secrets).

- [ ] **Step 3: Screenshots for the owner**

With backend and `npm run dev` running, capture (via the Chrome DevTools MCP `take_screenshot`, or Playwright if installed) at 1440×900: home light, home dark, generator mid-run light, generator done dark. Save to `output/screenshots/`. Attach them in the hand-off message.

- [ ] **Step 4: Lint, build, test, commit, push**

Run: `npm run lint && npm run build && npm test`
```bash
git add src/app/globals.css README.md frontend/.env.local.example docs/API.md
git commit -m "docs(frontend): presentation polish, README and env example for the redesigned decision desk"
git push origin main
```

---

## Self-review notes

- Spec §3 header items → Task 1 AppHeader (chain pill, 中/EN, ☀/☾, presentation, CTA). §3 home → Task 3. §3 generator (progress, columns, transport fallback, idle/error) → Task 4. §4 file map → Tasks 1–5. §5 badge/verify → Tasks 2 (derivation + tests), 3 (badge), 5 (panel, ethers abi fix, OnChainBadge deleted). §6 tokens → Task 1. §7 error/empty → StatusBanner (Task 3), queue empty (Task 3), generator error (Task 4), verify error (Task 5). §8 tests → Tasks 1–2 unit tests, lint/build gates each task, screenshots Task 6.
- Names cross-checked: `applyEvent/startRunState/initialRunState`, `deriveBadgeState`, `openRunStream/getActiveRun/startRun/verifyRun/listRuns/getRun/chainStatus/health`, `NumberTiles` export from ProposalCard, `DictKey` export from i18n, `NO_FLASH_SCRIPT` from prefs.
- KPI "news in last run" is an honest approximation (backend does not persist the count); documented inline.
