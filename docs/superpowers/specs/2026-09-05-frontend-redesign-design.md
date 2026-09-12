# Atlas Frontend Redesign — Design Spec

Date: 2026-09-05
Status: approved by the frontend owner (wenn00) after a visual brainstorming session
Deadline context: BUILDMODE hackathon submission 2026-09-06 11:30; demo has both a booth (laptop, judges click) and a stage (projector) round.

## 1. Goal

Replace the current two Next.js pages, which mix real API data with hard-coded mock content, with a
single coherent "decision desk" UI that only shows real data from the FastAPI backend, streams a live
run over SSE, and lets a judge verify (and deliberately tamper with) the on-chain audit record.

## 2. Decisions already made

| Topic | Decision |
|---|---|
| Stack | Keep Next.js 16 + React 19 + TypeScript + Tailwind v4 + ethers v6. Static export (`output: "export"`) for Cloudflare Pages must keep working. |
| Pages | Two pages: `/` (overview + history, layout **H1 queue + detail**) and `/generator` (live run, layout **G1 three-column live stream**). |
| Visual style | **A "decision desk"**: light canvas `#f3f6f4`, white cards, Cathay Financial green `#26a862` as primary (scraped from cathayholdings.com `--primary`). Dark variant: canvas `#0f1613`, cards `#151f1a`, primary lightened to `#3fc47c`. |
| Theme switch | Light / dark toggle in the header; `data-theme` on `<html>`, persisted in localStorage, initial value follows `prefers-color-scheme`. |
| Language | UI chrome switchable 中文 / English via a dictionary; AI-generated content stays as produced by the backend (Chinese). Persisted in localStorage, default 中文. |
| Presentation mode | Header toggle that raises the base font size (16 → 20 px), hides the KPI bar and widens spacing, for the projector. |
| Fake elements | Removed entirely: fake news items, always-green status lights, scripted terminal log, front-end computed premium, the "show Verified when in doubt" fallback. |
| Backend endpoints used | `POST /api/v1/runs`, `GET /api/v1/runs/{run_id}/events` (SSE), `GET /api/v1/runs`, `GET /api/v1/runs/{decision_id}`, `POST /api/v1/runs/{decision_id}/verify`, `GET /api/v1/chain/status`, `GET /api/v1/health`. The teammate's `all_reports` / `latest_report` / `run_agent` endpoints stay on the backend but are no longer called. |
| Config | `NEXT_PUBLIC_API_BASE` (default `http://localhost:8080`), `NEXT_PUBLIC_API_TOKEN` (default demo token), `NEXT_PUBLIC_SEPOLIA_RPC_URL`, `NEXT_PUBLIC_CONTRACT_ADDRESS`. No hard-coded `localhost:8080` in components. |

## 3. Information architecture

### Shared header (`AppHeader`)

Left: wordmark "Atlas 保險決策桌" / "Atlas Insurance Decision Desk". Right, in order: chain status pill
(from `/chain/status`: green "Sepolia" or grey "模擬"), language toggle 中/EN, theme toggle ☀/☾,
presentation-mode toggle, primary button "執行新一輪分析" linking to `/generator`.

### Home `/` — H1 queue + detail

- **KPI bar** (hidden in presentation mode): total proposals, on-chain count, news fetched in the
  latest run, last run time. All derived from `GET /runs` summaries and the latest full record.
- **Left column, run queue**: one row per record — product name, triggering news title, timestamp,
  chain status pill (已上鏈 / 模擬). Newest first. Default selection is the newest; `?id=<decision_id>`
  selects that record (the generator page navigates here on completion).
- **Right column, decision detail** with four tabs, all read from `GET /runs/{decision_id}`:
  1. **決策摘要**: product name, target audience, market gap, coverage details, exclusions, matched
     existing products (chips with category and distance).
  2. **Agent 辯論**: PM, underwriter and actuary texts with role avatars; a "重播" button replays them with
     typewriter pacing, purely client-side.
  3. **定價依據**: probability %, expected loss, premium range, markup multiplier; every number carries a
     source label ("精算引擎規則", to be replaced when real statistics land).
  4. **證據與稽核**: source news link, decision id, data hash, tx hash link, block number, network,
     plus the **VerifyPanel** (section 5).

### Generator `/generator` — G1 three-column live stream

- **StageProgress**: 11 segments in backend order — `news_fetched, news_selected, kb_matched,
  actuarial, pm, underwriter, actuary, report, chain_pending, chain_done, done`. Completed segments
  show elapsed seconds; the active one pulses; `error` marks the active segment red.
- **Left column**: news list appears on `news_fetched`; the selected item is highlighted and pinned on
  `news_selected`; matched product chips appear on `kb_matched`.
- **Middle column, DebateFeed**: PM / underwriter / actuary bubbles appear on their events with role
  avatar and seconds since run start; the next role shows a "審查中…" placeholder while pending.
- **Right column, ProposalCard + ChainBadge**: numbers fill on `actuarial`; product name and business
  logic on `actuary`; report path on `report`; badge turns amber on `chain_pending`, then green or grey
  on `chain_done`. On `done` a "查看完整提案" button navigates to `/?id=<decision_id>`.
- **Transport**: `EventSource` on the SSE endpoint. If the connection errors before `done`/`error`, fall
  back to polling `GET /runs/{run_id}` every second and feeding its `events` array through the same
  reducer. Reconnection never duplicates events (reducer is idempotent by event index).
- **Idle state** before starting: short explanation and the start button; **error state**: message and
  retry; the page never shows scripted status text.

## 4. Components and files

```
frontend/src/
  app/layout.tsx                 providers (theme, i18n, presentation), AppHeader, metadata title "Atlas"
  app/page.tsx                   H1 page
  app/generator/page.tsx         G1 page
  app/globals.css                design tokens as CSS variables for light/dark + presentation scale
  lib/types.ts                   RunSummary, RunRecord, Receipt, ActuarialData, MatchedProduct, NewsItem, RunEvent
  lib/api.ts                     typed client: listRuns, getRun, startRun, openRunStream, verifyRun, chainStatus, health
  lib/runReducer.ts              pure reducer: (state, RunEvent) -> state, plus stage index and timings
  lib/badge.ts                   pure: deriveBadgeState(receipt | pending | verifyResult) -> 'mock' | 'pending' | 'onchain' | 'mismatch'
  lib/i18n.ts                    dictionary zh/en, useT(), LanguageProvider
  lib/theme.ts                   ThemeProvider (light/dark), PresentationProvider
  lib/format.ts                  money, percent, short hash, relative time
  components/AppHeader.tsx
  components/KpiBar.tsx
  components/RunQueue.tsx
  components/DecisionDetail.tsx  tabs container
  components/DebateFeed.tsx      shared by H1 (replay) and G1 (live)
  components/ProposalCard.tsx
  components/NewsList.tsx
  components/MatchedProducts.tsx
  components/StageProgress.tsx
  components/ChainBadge.tsx      replaces OnChainBadge.tsx (deleted)
  components/VerifyPanel.tsx
```

Deleted: `components/OnChainBadge.tsx`. Untouched: `prototypes/`, backend.

## 5. Chain badge and verification rules

Badge state is derived only from backend data:

| Condition | State | Rendering |
|---|---|---|
| receipt.is_mock === true | `mock` | grey "模擬模式", no link |
| run in progress after `chain_pending`, before `chain_done` | `pending` | amber "上鏈中…" |
| receipt.blockchain_tx_hash && !is_mock | `onchain` | green "已上鏈 Sepolia", links to `verification_url` |
| last verify result matched === false | `mismatch` | red "驗證不符" |

"Verified" is never shown without a matching on-chain record. The optional read-only contract check
(ethers `getRecord`) lives inside VerifyPanel, uses the `abi` array from the Hardhat artifact (fixing
the current bug of passing the whole artifact), and on failure shows "無法連線 RPC", never success.

VerifyPanel: "驗證" calls `POST /runs/{id}/verify` and shows local hash, on-chain match, on-chain
timestamp, submitter. "竄改測試" reveals an editable `probability_pct` input prefilled from the payload;
submitting calls verify with `{tampered: {probability_pct: <value>}}` and highlights `tampered_fields`
in red when `matched` is false.

## 6. Design tokens

```
:root (light)            [data-theme=dark]
--bg        #f3f6f4      #0f1613
--surface   #ffffff      #151f1a
--surface-2 #f7faf8      #0f1613
--border    #e1e8e4      #243129
--text      #17211c      #e4ede7
--muted     #5b6a62      #a9b8af
--primary   #26a862      #3fc47c
--primary-soft #edf8f1   #16301f
--primary-ink #1b7d48    #6fdc9c
--warn      #c24d00      #ffc99b   (underwriter role, pending states; background #fff0e3 / #5a2d0c)
--danger    #b3261e      #ff8a80
--role-pm   #2b5cc7 on #e8f0ff   /  #bfdbfe on #1e3a8a
```

Numbers use the monospace font. Presentation mode sets `data-present` on `<html>`; tokens scale
`--font-base` from 16px to 20px and `--gap` from 16px to 24px.

## 7. Error and empty states

- Backend unreachable: a banner under the header ("無法連線後端 …/api/v1/health，請確認已啟動") with a retry
  button; pages still render their skeleton.
- No runs yet: empty state on `/` with a button to `/generator`.
- SSE `error` event: the active stage turns red, the message is shown, a retry button starts a new run.
- Verify endpoint error: shown inline in VerifyPanel; badge state unchanged.

## 8. Testing and acceptance

- Unit tests with Vitest for pure modules: `runReducer` (event order, idempotency, stage index, timings),
  `badge` (all four states), `i18n` (lookup and fallback), `format`.
- `npm run lint` and `npm run build` (static export) must pass at every commit.
- Playwright screenshots of both pages in light and dark themes are attached for the owner's review;
  the owner signs off on styling and requests adjustments afterwards.
- Implementation proceeds in six commits, each in English, no Co-Authored-By trailer:
  1. tokens, theme, i18n, presentation mode, AppHeader, layout metadata
  2. types, API client, runReducer, badge derivation, formatters (with tests)
  3. Home H1: KPI bar, RunQueue, DecisionDetail tabs, replay
  4. Generator G1: StageProgress, live columns, SSE with polling fallback
  5. ChainBadge and VerifyPanel, delete OnChainBadge
  6. presentation mode polish, empty/error states, screenshots

## 9. Out of scope

Mobile layouts (desktop only), translating AI-generated content, real actuarial statistics (separate
backend task), payout automation (explicitly rejected by the team).
