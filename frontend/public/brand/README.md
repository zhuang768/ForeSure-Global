# ForeSure 未然 — First Leaf 品牌素材

依使用者選定的 First Leaf Logo 整理，保留葉片 F 與「ForeSure／未然」字樣。
透明主圖使用內建 imagegen 進行背景分離，再裁切並輸出下列 PNG；皆不含提案頁的標題或其他展示內容。

| 檔案 | 尺寸 | 用途 |
| --- | --- | --- |
| `logo-lockup.png` | 1511 × 544 | 葉片與中英字樣組合，網站頁首 |
| `logo-wordmark.png` | 957 × 415 | 獨立中英字標 |
| `logo-mark.png` | 489 × 544 | 獨立葉片 F 圖示 |
| `logo-lockup-white.png` | 1511 × 544 | 深色背景使用的白色完整標誌 |
| `logo-wordmark-white.png` | 957 × 415 | 深色背景使用的白色字標 |
| `logo-mark-white.png` | 489 × 544 | 深色背景使用的白色葉片 |
| `logo-app-icon.png` | 512 × 512 | 深綠底白葉，應用程式圖示 |

深綠底色為 `#104d36`。除應用程式圖示外，素材皆保留透明背景。
這些素材是 PNG 點陣圖，請保持原始比例，避免放大超過原始尺寸。

共用元件：`src/components/BrandLogo.tsx`，支援 `lockup`、`wordmark`、`mark`、`tile`。
`className` 可設定顯示尺寸；純裝飾用途傳入 `decorative`。
深色模式透過既有 `data-theme` CSS 自動將透明 Logo 轉為白色，避免首次載入時閃爍。

```tsx
<BrandLogo className="h-12 w-auto" />
<BrandLogo variant="mark" className="h-8 w-auto" />
<BrandLogo variant="tile" className="size-10 rounded-lg" />
```

Next.js 圖示放在 `src/app/`：`favicon.ico`（16、32、48 px）、`icon.png`（192 px）、`apple-icon.png`（180 px）。
原始參考圖、透明提取圖與提取提示詞保留在本機的 `output/imagegen/foresure-first-leaf-*`，不收進版本庫。
