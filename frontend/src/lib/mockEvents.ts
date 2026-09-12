import type { RunEvent } from "./types";

export const MOCK_EVENTS: RunEvent[] = [
  {
    stage: "news_fetched",
    data: [
      {
        title: "強颱即將登陸，南部沿海防範嚴重淹水",
        link: "https://example.com/news/1",
        published: "2026-09-05T08:00:00Z",
        summary: "中央氣象局發布強烈颱風警報，預計帶來驚人雨量，農損風險極高。",
        source: "氣象新聞",
        is_mock: false,
      },
      {
        title: "高溫不退！今年恐成史上最熱夏天",
        link: "https://example.com/news/2",
        published: "2026-09-04T12:00:00Z",
        summary: "極端氣候導致多地氣溫飆破38度，戶外勞工中暑頻傳。",
        source: "環境中心",
        is_mock: false,
      },
    ],
  },
  {
    stage: "news_selected",
    data: {
      title: "強颱即將登陸，南部沿海防範嚴重淹水",
      link: "https://example.com/news/1",
      published: "2026-09-05T08:00:00Z",
      summary: "中央氣象局發布強烈颱風警報，預計帶來驚人雨量，農損風險極高。",
      source: "氣象新聞",
      is_mock: false,
    },
  },
  {
    stage: "kb_matched",
    data: [
      {
        id: "P-1",
        name: "農漁業天災綜合保險",
        category: "Agriculture",
        description: "針對極端降雨與颱風造成的農業損失進行理賠。",
        distance: 0.15,
      },
      {
        id: "P-2",
        name: "住家淹水基本險",
        category: "Property",
        description: "保障沿海與低窪地區住戶淹水損失。",
        distance: 0.22,
      },
      {
        id: "P-3",
        name: "營業中斷保險",
        category: "Business Interruption",
        description: "停電或淹水造成之營業停擺補償。",
        distance: 0.28,
      },
    ],
  },
  {
    stage: "actuarial",
    data: {
      probability_pct: 12.5,
      expected_loss_usd: 50000,
      premium_range_usd: [2500, 3500],
      markup_multiplier: [1.2, 1.5],
      basis: {
        peril: "Typhoon Flood",
        annual_frequency: 3.2,
        probability_source: "assumption",
        loss_source: "assumption",
        loss_method: "assumption",
      },
    },
  },
  {
    stage: "pm",
    data: "針對此次強颱帶來的極端降雨威脅，我們應該推出「強降雨農漁業速賠險」，主打 48 小時內依據氣象局降雨量自動理賠，解決農民等待勘災的痛點。",
  },
  {
    stage: "underwriter",
    data: "同意參數型理賠的方向，但必須嚴格定義「降雨量達標」的測站範圍與門檻。南部沿海風險較高，建議針對該區域設定較高的保費費率，並將單次最高理賠金額上限設在 100 萬台幣以控管巨災風險。",
  },
  {
    stage: "actuary",
    data: "考量發生機率為 12.5%，預期單次損失為 $50,000 USD。根據核保部建議的 100 萬台幣上限，我們可將保費區間精確鎖定在 $2,800 - $3,200 USD，並採用 1.4 倍的風險溢價因子來確保利潤空間，這樣的費率結構在財務上是穩健的。",
  },
  {
    stage: "grounding",
    data: {
      status: "pass",
      checker_version: "grounding-check/v1",
      checked_claims: 3,
      grounded_claims: 3,
      flag_count: 0,
      evidence_sources: ["actuarial_engine", "news", "matched_products"],
      flags: [],
    },
  },
  {
    stage: "report",
    data: {
      product_name: "強降雨農漁業參數型保險",
      target_audience: "南部沿海高風險農漁業從業人員及養殖業者",
      market_gap: "傳統勘災理賠耗時過長，農民缺乏即時復原資金。",
      coverage_details: "氣象局發布特定測站 24 小時累積雨量超過 300mm，即自動啟動理賠，無須人工勘災。\n理賠款項於 48 小時內直撥保戶帳戶，最高理賠 USD 50,000。",
      exclusions: "若非因颱風或豪雨警報期間造成之損失，或非約定測站之數據，不在理賠範圍內。",
      business_logic: "整合氣象局 API 進行自動觸發與合約執行，大幅降低理賠審查的人力成本與爭議。",
    },
  },
  {
    stage: "chain_pending",
    data: {
      network: "mock",
    },
  },
  {
    stage: "chain_done",
    // Offline playback never touches the chain, so the receipt says so: no tx, no explorer link.
    data: {
      blockchain_tx_hash: null,
      block_number: null,
      verification_url: null,
      network: "mock",
      is_mock: true,
    },
  },
  {
    stage: "done",
    data: {
      decision_id: "foresure-20260905-" + Math.random().toString(36).slice(2, 10),
      run_id: "run-foresure-20260905-" + Math.random().toString(36).slice(2, 10),
      timestamp: new Date().toISOString(),
      report_path: "reports/run-latest.json",
      proposal_data: {
        is_mock: false,
        model: "gemini-3.5-flash-lite",
      },
    },
  },
];
