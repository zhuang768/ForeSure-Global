# 未然 ForeSure 參數型保險決策桌 — 完整設計系統規範 (Design System Specification)

> **版本**：v2.0 (Powered by `ui-ux-pro-max` Design Intelligence)  
> **風格定位**：金融儀器級極簡風格 (Financial Instrument Grade & Swiss Minimalism)  
> **核心品牌識別**：國泰金融綠 (Cathay Green) × 智能合約不可篡改存證 (Ethereum Sepolia Proof)  
> **規範準則**：嚴格零表情符號 (Zero Emojis)、純向量 SVG 圖示、WCAG 2.1 AA+ 無障礙標準、即時雙色溫切換 (Light / OLED Dark)

---

## 1. 設計哲學與視覺語言 (Design Philosophy)

「未然 ForeSure」作為針對氣候變遷、AI 基礎架構斷線與高科技供應鏈等新興巨災的自主決策桌，介面必須呈現**冷靜、精準、具監理級說服力**的數位金融儀器風格：
1. **信賴與權威 (Trust & Authority)**：以精密資料表、雜湊字串 (SHA-256)、Etherscan 鏈上證明與嚴謹精算數字建立不可動搖之公信力。
2. **三代理人制衡 (Tri-Agent Balance)**：透過清晰的色彩分流（PM 商業藍、核保 風控橘、精算 審慎綠）直觀呈現多代理人對抗辯論之制衡張力。
3. **極致機能與高資訊密度 (Data Density & Legibility)**：兼顧 85 秒現場展示的強烈視覺衝擊，與評審查驗 20 筆歷史提案時的 0 毫秒極速檢閱。
4. **絕對嚴肅性 (Instrument Seriousness)**：全站徹底杜絕任何 Emoji 裝飾，全面採用高精準度幾何與 SVG 向量圖標。

---

## 2. 色彩系統 (Color Palette & Tokens)

色彩系統支援深淺雙模式，採用 CSS 自定義屬性（CSS Custom Properties）與 Tailwind CSS v4 `@theme inline` 註冊：

### 2.1 語意化色票總表 (Semantic Color Matrix)

| 語意變數 | 淺色模式 (Light) | 深色模式 (OLED Dark) | 用途說明 | 最小對比度 (WCAG) |
|---|---|---|---|---|
| `--bg` | `#f3f6f4` (冷灰綠底) | `#0f1613` (極致深墨) | 全站頁面畫布背景 | — |
| `--surface` | `#ffffff` (純白) | `#151f1a` (深墨綠卡片) | 主要容器、卡片、對話框底色 | 對比底色 ≥ 1.2:1 |
| `--surface-2` | `#f7faf8` (淺層背景) | `#0f1613` (深沉內嵌) | 巢狀面板、表格標頭、分段背景 | — |
| `--border` | `#e1e8e4` (微灰綠線) | `#243129` (夜幕微光線) | 分隔線、卡片邊框、輸入框邊框 | 介面組件 ≥ 3:1 |
| `--text` | `#17211c` (墨黑) | `#e4ede7` (冷白) | 一級標題、主要內文、數值 | ≥ 10.5:1 (超越 AAA) |
| `--muted` | `#5b6a62` (深灰綠) | `#a9b8af` (冷銀灰) | 二級標籤、次要描述、欄位名 | ≥ 4.8:1 (符合 AA) |
| `--primary` | `#26a862` (國泰綠) | `#3fc47c` (高動態螢光綠) | 主要 CTA、活動按鈕、關鍵焦點 | 醒目度指標 |
| `--primary-soft` | `#edf8f1` (淺綠膠囊底) | `#16301f` (暗綠發光底) | 藥丸標籤、選取態背景、徽章 | — |
| `--primary-ink` | `#1b7d48` (深綠強調字) | `#6fdc9c` (淺綠高亮字) | 綠色標籤文字、連結、即時狀態 | ≥ 4.6:1 |
| `--warn` | `#c24d00` (警戒橘) | `#ffc99b` (亮橘黃) | 執行中狀態、審查倒數、中度風險 | ≥ 4.5:1 |
| `--warn-soft` | `#fff0e3` (淺橘底) | `#5a2d0c` (深棕橘底) | 執行中計時器藥丸、警告標籤 | — |
| `--danger` | `#b3261e` (危機紅) | `#ff8a80` (螢光珊瑚紅) | 竄改測試報警、錯誤、高風險暴露 | ≥ 4.5:1 |
| `--danger-soft` | `#fdecea` (淺粉紅底) | `#4a1512` (深酒紅底) | 雜湊不相符提示、高危除外條款底色 | — |

### 2.2 三方 AI 代理人專屬角色色彩 (Agent Triad Tokens)

| 角色名稱 | 角色代號 | 主角色變數 | 角色淺底變數 | 象徵意義 | 淺色 Hex / 深色 Hex |
|---|---|---|---|---|---|
| **產品經理 (PM)** | `role-pm` | `--role-pm` | `--role-pm-soft` | 商業敏銳度、市場洞察 | `#2b5cc7` / `#bfdbfe` |
| **核保人員 (UW)** | `role-uw` | `--role-uw` | `--role-uw-soft` | 道德風險防範、嚴密審核 | `#c24d00` / `#ffc99b` |
| **總精算師 (AC)** | `role-ac` | `--role-ac` | `--role-ac-soft` | 數學審慎、償付能力建模 | `#1b7d48` / `#6fdc9c` |

---

## 3. 字型排印系統 (Typography System)

字型遵循 **金融數字等寬 (Tabular Monospace)** 與 **現代非襯線字體 (Modern Sans)** 雙軸心架構。

### 3.1 字型家族配對 (Font Stacks)

- **主介面無襯線字 (Sans-serif)**：
  ```css
  font-family: var(--font-geist-sans), "IBM Plex Sans", "PingFang TC", "Noto Sans TC", system-ui, sans-serif;
  ```
  適用於：所有標題、導覽文字、卡片標籤、說明內文。
- **等寬數據與程式碼字 (Monospace & Tabular Data)**：
  ```css
  font-family: var(--font-geist-mono), "Fira Code", "JetBrains Mono", ui-monospace, Menlo, monospace;
  font-variant-numeric: tabular-nums;
  ```
  適用於：保費區間、期望損失金額、發生機率、決策 SHA-256 雜湊碼、以太坊交易雜湊、計時器。

### 3.2 排印階層規格表 (Type Scale)

| 階層名稱 | 字級 (Desktop / Mobile) | 行高 | 字重 (Weight) | 字距 (Tracking) | CSS 類別 / 標籤範例 |
|---|---|---|---|---|---|
| **Hero Display (H1)** | `60px (3.75rem)` / `36px` | `1.08` | `800 (ExtraBold)` | `-0.035em` | `text-4xl sm:text-6xl font-extrabold tracking-tight` |
| **Section Title (H2)** | `30px (1.875rem)` / `24px` | `1.2` | `700 (Bold)` | `-0.025em` | `text-2xl sm:text-3xl font-bold tracking-tight` |
| **Card Header (H3)** | `18px (1.125rem)` / `16px` | `1.3` | `700 (Bold)` | `-0.015em` | `text-lg font-bold tracking-tight` |
| **Body Primary** | `15px (0.9375rem)` / `14px` | `1.6` | `400 (Regular)` | `0` | `text-sm sm:text-base leading-relaxed` |
| **Body Secondary** | `13px (0.8125rem)` / `12px` | `1.5` | `400 (Regular)` | `0` | `text-xs text-muted leading-relaxed` |
| **Micro Labels (標籤)** | `11px (0.6875rem)` | `1.2` | `700 (Bold)` | `+0.08em` | `.label` (大寫、加寬字距、次要色彩) |
| **Data Numbers (大型數值)** | `28px (1.75rem)` | `1.1` | `800 (ExtraBold)` | `-0.02em` | `mono text-2xl font-extrabold tabular-nums` |
| **Hash / Blockchain (存證)** | `11px (0.6875rem)` | `1.3` | `500 (Medium)` | `+0.02em` | `mono text-[11px] select-all` |

---

## 4. 空間佈局與格線系統 (Layout, Spacing & Grid)

### 4.1 8-Point 基礎空間網格 (Spatial Rhythm)
全站外距 (Margin)、內距 (Padding)、元件間隙 (Gap) 嚴格遵循 4px / 8px 階層：
- `4px` (`gap-1`, `p-1`)：藥丸標籤內部、小型按鈕內部
- `8px` (`gap-2`, `p-2`)：按鈕內距、密集資訊塊
- `12px` (`gap-3`, `p-3`)：卡片子區塊、工具列項目
- `16px` (`gap-4`, `p-4`)：標準卡片內距、表單欄位間隔
- `24px` (`gap-6`, `p-6`)：大卡片內距、區塊間垂直節奏
- `32px` (`gap-8`, `py-8`)：頁面區塊上下間距
- `48px` (`gap-12`, `py-12`)：首頁主要段落間隔

### 4.2 容器最大寬度限制 (Container Viewports)
- **內容閱讀與介紹頁面 (`/`)**：`max-w-[1400px]`，確保長文字段落維持最佳可讀字元寬度。
- **高密度工作台與歷史庫 (`/history`, `/generator`)**：`max-w-[1800px]`，給予三欄並排與多欄位資料表充足水平擴展空間。
- **響應式斷點 (Breakpoints)**：
  - `sm`: `640px`
  - `md`: `768px`
  - `lg`: `1024px`
  - `xl`: `1280px`
  - `2xl`: `1536px`

---

## 5. 陰影、層次與表面 (Elevation & Surfaces)

ForeSure 拒絕粗糙厚重的單層陰影，採用細膩多層次環境光漫射，並以邊框（Border）強化物件幾何邊界：

```css
/* 基礎陰影階層 */
--shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.04);
--shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04);

/* 毛玻璃穿透效果 */
.glass-header {
  background: color-mix(in srgb, var(--surface) 95%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
```

---

## 6. 微互動與動態數值 (Motion & Micro-interactions)

本系統依據 `ui-ux-pro-max` 的 Context-Aware Timing 規範，提供精確之過渡與貝茲曲線數值：

### 6.1 動畫持續時間與緩動函數 (Duration & Easing)

| 互動場景 | 推薦時間 | 緩動曲線 (Bezier) | 說明 |
|---|---|---|---|
| **按鈕懸停 / 點擊反饋** | `120ms` | `cubic-bezier(0.4, 0, 0.2, 1)` (ease-in-out) | 極速反饋，避免按鈕延遲感 |
| **主題切換 / 顏色過渡** | `150ms` | `ease` | 快速平滑切換，無閃爍感 |
| **手風琴摺疊 / 下拉展開** | `220ms` | `cubic-bezier(0.16, 1, 0.3, 1)` (out-expo) | 自然展開與收合 |
| **即時辯論動態打字流** | `850ms` | `cubic-bezier(0.4, 0, 0.6, 1)` | 模擬 AI 思考脈絡打字呼吸燈 |
| **鏈上廣播中脈衝** | `900ms` (alternate) | `ease-in-out` | 柔和透明度交替（0.45 ↔ 1.0） |

### 6.2 無障礙動態支援 (Reduced Motion Fallback)
```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 7. 核心組件庫規範 (Component Specifications)

### 7.1 按鈕 (Buttons)

按鈕必須保證 `cursor: pointer`，點擊熱區最小 `44×44px`。

```tsx
/* 1. 主要操作按鈕 (Primary Button) */
<button className="btn btn-primary px-4 py-2 text-xs font-semibold shadow-sm hover:shadow transition-all">
  ▶ 執行新一輪分析
</button>

/* 2. 次要輪廓按鈕 (Secondary Button) */
<button className="btn btn-secondary px-3 py-1.5 text-xs">
  系統介紹
</button>

/* 3. 專屬品牌色彩按鈕 (Brand Highlight Pill Link) */
<Link
  href="/history"
  className="btn px-3 py-1 text-xs font-semibold bg-primary-soft text-primary-ink border border-primary/60 hover:bg-primary hover:text-white transition-all shadow-xs"
>
  歷史分析與存證紀錄庫
</Link>

/* 4. 二選一分段控制器 (Segmented Control - 零 Emoji) */
<div className="inline-flex items-center rounded-md border border-border bg-surface-2 p-0.5 text-xs">
  <button
    type="button"
    onClick={() => setLang("zh")}
    className="rounded px-2.5 py-0.5 text-xs font-semibold bg-primary text-white shadow-xs"
  >
    中
  </button>
  <button
    type="button"
    onClick={() => setLang("en")}
    className="rounded px-2.5 py-0.5 text-xs font-semibold text-muted hover:text-text"
  >
    EN
  </button>
</div>
```

### 7.2 藥丸與狀態徽章 (Pills & Status Badges)

```tsx
/* 鏈上已存證 (Sepolia Verified) */
<span className="pill bg-primary-soft text-primary-ink font-medium">
  ● 12 / 20 Sepolia 已存證
</span>

/* 模擬存證 (Mock Mode) */
<span className="pill border border-border bg-surface text-muted font-medium">
  ○ 模擬模式
</span>

/* 執行審查中 (Underwriting Running) */
<span className="pill bg-warn-soft text-warn font-semibold pulse">
  ● 審查中… · 已耗時 14s
</span>
```

### 7.3 KPI 指標磁磚 (Metric Tile)

```tsx
<div className="card flex flex-col justify-between p-4">
  <div className="label text-xs text-muted">單次預期損失 (Expected Loss)</div>
  <div className="mt-2 text-2xl font-bold tracking-tight text-text">
    <span className="mono">USD 4.5M</span>
    <span className="ml-1.5 text-xs font-normal text-muted">/ Incident</span>
  </div>
</div>
```

### 7.4 三方 AI Agent 對抗卡片 (Agent Card)

```tsx
/* PM 角色卡片 (上邊框指示條) */
<div className="card border-t-4 border-t-role-pm p-6 flex flex-col justify-between">
  <div>
    <div className="flex items-center justify-between">
      <span className="pill bg-role-pm-soft text-role-pm font-bold">PM AGENT</span>
      <span className="text-xs text-muted">Role 01</span>
    </div>
    <h3 className="mt-4 text-base font-bold text-text">產品經理 (PM Agent)</h3>
    <p className="mt-2 text-xs leading-relaxed text-muted">時事痛點洞察、保障缺口挖掘...</p>
  </div>
</div>
```

---

## 8. 無障礙與合規檢查清單 (Accessibility & Compliance Checklist)

- [x] **零 Emoji 準則**：所有介面嚴禁使用 Emoji 表情符號；所有圖示皆採用純向量 SVG（尺寸固定為 12px–16px，使用 `currentColor`）。
- [x] **色彩對比度**：正文與背景對比度達標 `4.5:1` 以上；大標題與數值達標 `7:1` 以上。
- [x] **鍵盤導覽焦點環**：所有互動按鈕與輸入框提供 `2px` 鮮明外框 (`outline: 2px solid var(--primary); outline-offset: 2px`)。
- [x] **無障礙標籤 (Aria Labels)**：所有無文字或圖示切換按鈕均附帶 `aria-label` 與 `title` 屬性。
- [x] **字元截斷防護**：歷史紀錄卡片採用 `line-clamp-2` 並設定彈性高度，禁止出現文字斷頭或重疊。
- [x] **數值對齊防抖**：所有動態倒數、保費金額、機率數值強制套用 `tabular-nums`，切換數值時寬度零晃動。

---

## 9. Tailwind CSS v4 整合指引 (Implementation Blueprint)

在 `frontend/src/app/globals.css` 中，所有設計變數已完全對齊本規範：

```css
@import "tailwindcss";

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
```
