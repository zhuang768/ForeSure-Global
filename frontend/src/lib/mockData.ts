/**
 * Offline demo data, shown when no backend is reachable.
 * Every record here is labelled as a mock: no chain receipt, no tx hash, no explorer link.
 * The badges and counters must never present demo content as anchored on Sepolia.
 */

import type { RunRecord, RunSummary } from "./types";

// ── helpers ──────────────────────────────────────────────────────────────────

function ts(minutesAgo: number): string {
  const d = new Date(Date.now() - minutesAgo * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function stampId(minutesAgo: number): string {
  const d = new Date(Date.now() - minutesAgo * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `foresure-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${
    Math.random().toString(36).slice(2, 10)
  }`;
}

// ── run records ──────────────────────────────────────────────────────────────

const RUN_DATA: Array<{
  minutesAgo: number;
  newsTitle: string;
  newsSource: string;
  newsSummary: string;
  newsLink: string;
  productName: string;
  targetAudience: string;
  marketGap: string;
  coverageDetails: string;
  exclusions: string;
  businessLogic: string;
  probabilityPct: number;
  expectedLossUsd: number;
  premiumMin: number;
  premiumMax: number;
  pmDebate: string;
  underwriterDebate: string;
  actuaryDebate: string;
  peril: string;
  annualFrequency: number;
}> = [
  {
    minutesAgo: 1,
    newsTitle: "企業AI與雲端依賴營業中斷保險（Enterprise AI-Dependency Business Interruption）",
    newsSource: "Reuters Tech",
    newsSummary:
      "ChatGPT、Claude、Gemini down. What we know about the AI outage that crippled enterprise workflows for 6 hours across Asia-Pacific.",
    newsLink: "https://example.com/ai-outage",
    productName: "企業AI與雲端依賴營業中斷保險（Enterprise AI-Dependency Business Interruption Insurance）",
    targetAudience:
      "導入生成式AI API、SaaS服務與雲端自動化流程的中小型科技公司、數位行銷公司及跨境電商。",
    marketGap:
      "傳統資安險偏強調「駭客惡意入侵與資料外洩」，對於「高度依賴AI與雲端大模型進行日常營運之現代企業，因基礎設施全面癱瘓所成的營業中斷與生產力損失」存在完全的保障真空。",
    coverageDetails:
      "1. 承保範圍：因全球主流雲端基礎設施或基礎大模型API突發性全面中斷（非單一企業端網路問題），導致企業核心自動化營運流程停擺之業務中斷損失。\n2. 理賠門檻：需經第三方公正雲端監控平台證實主流AI服務商同時中斷4小時以上。\n3. 給付方式：採實際損失填補原則（Indemnity Basis），依據企業前一年度財報或營業額計算之日均損益之實支實付，最高理賠額度為 USD 50,000。",
    exclusions:
      "1. 被保險人自身的網路設備故障、內部斷網或資安防護不當。\n2. 違主管機關命令存放或合約引引起的系統暫停。\n3. 刻意按採納線、蓄意破壞API連接等明顯違德風險行為（須透過數位足跡與日誌稽查）。",
    businessLogic:
      "系統主動對接主要雲端監控 API（如 Datadog、AWS Health API、GCP Status），自動偵測觸發條件並在條件成立後直接以參數型方式進行理賠計算，大幅縮短理賠週期。",
    probabilityPct: 5.0,
    expectedLossUsd: 50000,
    premiumMin: 3000,
    premiumMax: 4500,
    pmDebate:
      "這波AI服務大中斷事件明確揭示了一個全新的保險缺口。我的建議是推出「企業AI依賴中斷險」，採用參數型理賠機制——只要主流AI平台同時中斷超過4小時，就自動理賠，無須複雜的損失舉證。這大幅降低核保與理賠的行政成本，也提升了客戶信任。",
    underwriterDebate:
      "我支持參數型設計，但需要嚴格定義「觸發條件」。建議採用至少兩家以上獨立第三方監控服務（如Datadog、Pingdom）同時確認中斷，以避免單點誤報。另外，保額上限設在USD 50,000並要求企業提供前一年度AI採購發票作為核保依據，可有效控管逆選擇風險。",
    actuaryDebate:
      "根據過去3年主要AI平台停機事件分析，發生機率約5%。預期單次損失USD 50,000，年化保費應落在USD 3,000-4,500區間，損失率控制在65%以下，符合核保標準。",
    peril: "AI Platform Outage",
    annualFrequency: 0.87,
  },
  {
    minutesAgo: 3,
    newsTitle: "企業資安潛伏期防護保險（Cyber-Dwell Defense Insurance）",
    newsSource: "Cybersecurity Ventures",
    newsSummary:
      "在客戶手邊平均有17天潛伏期，到底如何補救？研究顯示駭客平均潛伏197天才被發現。",
    newsLink: "https://example.com/cyber-dwell",
    productName: "企業資安潛伏期防護保險（Cyber-Dwell Defense Insurance）",
    targetAudience: "中型製造業、金融科技公司、醫療機構及持有大量客戶個資的企業。",
    marketGap:
      "傳統資安險多以「事件發現日」為理賠起點，忽略了駭客潛伏期間造成的隱性損失——如持續的資料洩露、系統慢速破壞、與競業情報竊取。",
    coverageDetails:
      "1. 承保期間：自入侵日（forensic溯源）至發現日之潛伏損失\n2. 覆蓋項目：資料洩漏造成的客戶流失損失、合規罰款、法律費用\n3. 最高理賠：USD 200,000/年",
    exclusions: "內部人員故意洩密、未達基本資安標準（如無MFA）、政治動機攻擊。",
    businessLogic:
      "與企業簽約時要求安裝EDR（Endpoint Detection & Response）監控工具，系統可自動生成入侵時間線報告作為理賠依據。",
    probabilityPct: 8.5,
    expectedLossUsd: 80000,
    premiumMin: 5000,
    premiumMax: 8000,
    pmDebate:
      "資安潛伏期是業界最被忽視的風險缺口。我建議以「潛伏期天數×日均損失」作為理賠計算基礎，讓理賠更透明、可溯源。",
    underwriterDebate:
      "必須要求投保企業提供每季SOC 2 Type II報告作為持續核保條件，潛伏期超過90天的案例應設定理賠上限，避免道德風險。",
    actuaryDebate:
      "根據Verizon DBIR 2024數據，製造業平均潛伏期197天，金融業63天。以8.5%發生率、平均損失USD 80,000計算，年化保費USD 5,000-8,000合理。",
    peril: "Cyber Intrusion",
    annualFrequency: 1.2,
  },
  {
    minutesAgo: 5,
    newsTitle: "醫療機構首長合規延誤失敗保險（附卡「智御合規」）",
    newsSource: "衛生福利部新聞稿",
    newsSummary:
      "衛生福利部新制醫院評鑑啟動，多間地區醫院因資安合規不足面臨降等處分，院長個人責任風險升高。",
    newsLink: "https://example.com/hospital-compliance",
    productName: "醫療機構首長合規延誤失敗保險（智御合規附加保障）",
    targetAudience: "中型醫院院長、醫療法人董事長、診所院長及醫療集團管理層。",
    marketGap:
      "醫院評鑑新制下，首長個人需對資安合規失敗承擔連帶責任，但現行D&O（董監事責任險）未涵蓋衛生主管機關罰款及評鑑降等損失。",
    coverageDetails:
      "1. 主動覆蓋：評鑑降等造成的收入損失（最多12個月）\n2. 法律費用：行政訴訟及抗辯費用\n3. 個人罰鍰：衛福部行政裁罰轉嫁給個人之部分\n4. 附加服務：「智御合規」平台一年訂閱（AI輔助合規進度追蹤）",
    exclusions: "故意違規、未在保單期間內完成評鑑要求之底線措施。",
    businessLogic:
      "整合衛福部醫院評鑑資料庫API，自動追蹤各院所合規進度並提前預警，作為核保與差異化定價依據。",
    probabilityPct: 12.0,
    expectedLossUsd: 120000,
    premiumMin: 8000,
    premiumMax: 15000,
    pmDebate:
      "醫療合規風險在台灣尚未有對應的保險產品。「附卡」設計（搭配合規SaaS平台）可以製造差異化並降低理賠率，因為投保機構的合規水準會被主動監控。",
    underwriterDebate:
      "需要評估各醫院過去3年評鑑記錄作為核保依據。對於曾被警告或降等的機構，應加收25%-40%保費附加。",
    actuaryDebate:
      "台灣醫院評鑑降等率約12%，但加入AI合規監控後預估可降至7%。以此計算年化保費合理範圍為USD 8,000-15,000。",
    peril: "Regulatory Non-Compliance",
    annualFrequency: 1.8,
  },
  {
    minutesAgo: 8,
    newsTitle: "「食安無虞」特定病原菌醫療保險（大腸桿菌案）",
    newsSource: "Food Safety News",
    newsSummary:
      "E.coli blueberry recall expanding to frozen mixed berry packaging — 17 states affected, 3 hospitalized.",
    newsLink: "https://example.com/ecoli-recall",
    productName: "「食安無虞」特定病原菌醫療費用補償保險",
    targetAudience: "喜好購買生鮮食品、冷凍食品及外食族的一般消費者，特別是有幼童及長者的家庭。",
    marketGap:
      "台灣食安事件頻繁，但現有健保給付不涵蓋因食安問題引發的延伸醫療費用（如住院期間的特殊飲食、長期追蹤檢查），且求償廠商的法律途徑費時費力。",
    coverageDetails:
      "1. 承保病原：沙門氏菌、大腸桿菌O157、諾羅病毒\n2. 觸發條件：衛福部發布相關食品召回公告或疫調確認\n3. 定額補償：住院每日USD 100，門診每次USD 30，最高USD 5,000\n4. 快速理賠：提供就診收據即可申請，3工作日撥款",
    exclusions: "非食品來源的腸胃道感染、慢性腸道疾病、自行購買非認證食品。",
    businessLogic:
      "對接衛福部食品藥物管理署API，自動監控食品召回公告。一旦觸發，主動通知保戶並啟動理賠流程，實現真正的「主動式保險」。",
    probabilityPct: 3.5,
    expectedLossUsd: 3000,
    premiumMin: 200,
    premiumMax: 400,
    pmDebate:
      "這是一個高頻率、低嚴重度的風險，非常適合做成低保費的附加險或嵌入式保險。可以考慮與momo購物、全聯等食品零售商合作，在結帳時嵌入投保選項。",
    underwriterDebate:
      "觸發條件必須清楚定義為「政府公告的特定批次召回」，而非一般腸胃炎。建議引入等待期設計（投保後30天內的事件不理賠）。",
    actuaryDebate:
      "台灣近5年平均每年有3.5次重大食品召回事件，單次理賠平均USD 3,000。定價USD 200-400/年，損失率約52%，財務上可行。",
    peril: "Foodborne Illness",
    annualFrequency: 3.5,
  },
  {
    minutesAgo: 13,
    newsTitle: "生醫供應鏈彈性保險：醫療物流資安中斷綜合保障方案",
    newsSource: "Medical Device Daily",
    newsSummary:
      "Boston Scientific begins to restore shipping after cyberattack; 72-hour delivery disruption affected 1,200 hospitals across 8 countries.",
    newsLink: "https://example.com/boston-scientific",
    productName: "生醫供應鏈彈性綜合保險（Medical Supply Chain Resilience）",
    targetAudience: "中型醫療耗材進口商、醫療器材經銷商及提供醫院物流服務的第三方倉儲業者。",
    marketGap:
      "現有貨物運輸險不涵蓋因供應商遭受網路攻擊導致的出貨延誤損失，而一般營業中斷險又要求「實體損毀」才能理賠。",
    coverageDetails:
      "1. 觸發條件：主要供應商因資安事件宣布停止出貨超過48小時\n2. 補償項目：緊急替代採購成本差額、空運改裝費用、醫院違約罰款\n3. 最高理賠：USD 300,000/年",
    exclusions: "已知的供應商財務問題、自然災害、海關扣押。",
    businessLogic:
      "整合Supply Chain Risk Management平台（如RiskRecon）監控供應商資安健康狀況，作為動態定價依據。",
    probabilityPct: 6.0,
    expectedLossUsd: 150000,
    premiumMin: 7000,
    premiumMax: 12000,
    pmDebate:
      "2024年醫療供應鏈攻擊事件激增，但市場上幾乎沒有針對「間接受害者（進口商/經銷商）」的保險產品。這是明確的市場空白。",
    underwriterDebate:
      "需要評估被保企業的主要供應商集中度——若單一供應商佔採購量超過60%，應提高保費或降低承保額度。",
    actuaryDebate:
      "參考Chainanalyze 2024報告，醫療供應鏈資安攻擊年均6.0次，單次影響時間平均72小時。年化保費USD 7,000-12,000合理。",
    peril: "Supply Chain Cyber Attack",
    annualFrequency: 0.9,
  },
  {
    minutesAgo: 18,
    newsTitle: "都會流域智慧防汛車隊保險（Smart Urban Flood Fleet Management）",
    newsSource: "中央社",
    newsSummary:
      "基隆淹水修繕車主受困路段，被迫緊急支援支付系統，如何結合氣象及時補償？",
    newsLink: "https://example.com/flood-fleet",
    productName: "都會流域智慧防汛車隊綜合保險",
    targetAudience: "台北、新北、基隆、高雄市區擁有5輛以上車輛的企業車隊、共享汽車業者及計程車行。",
    marketGap:
      "現有車險的水災理賠需要現場勘查，曠日廢時；車隊業者面臨「車輛受困但客戶仍需服務」的雙重損失，現無產品可一次性涵蓋。",
    coverageDetails:
      "1. 參數型觸發：氣象局發布豪大雨特報且特定測站24小時雨量超過200mm\n2. 涵蓋損失：車輛受困期間租金損失、緊急替代車輛租用費\n3. 快速理賠：觸發後48小時內自動撥付基本補償金",
    exclusions: "非暴雨期間的道路積水、車輛本身機械故障、司機駕駛疏失。",
    businessLogic:
      "與UberFleet、台灣大車隊合作嵌入式投保，結合中央氣象局Open API進行參數型理賠。",
    probabilityPct: 18.0,
    expectedLossUsd: 20000,
    premiumMin: 2800,
    premiumMax: 4200,
    pmDebate:
      "車隊業者痛點非常明確：颱風來了，車跑不了但客戶還是要服務。參數型設計可以讓理賠幾乎即時發生，非常適合B2B嵌入式保險。",
    underwriterDebate:
      "需要依據投保地點的歷史淹水頻率進行區域差異化定價。基隆、蘆洲等高風險地區應有25%附加保費。",
    actuaryDebate:
      "台灣主要都會區年均重大淹水事件2.3次，車隊業者平均單次損失USD 20,000。年化保費USD 2,800-4,200，損失率約68%，在可接受範圍內。",
    peril: "Typhoon Flood",
    annualFrequency: 2.3,
  },
  {
    minutesAgo: 24,
    newsTitle: "都會動態防汛車輛守護險（微型氣候指數附加條款）",
    newsSource: "自由時報",
    newsSummary:
      "北市多處地下停車場積水，車主求償無門，保險公司稱需提供淹水深度證明才能理賠。",
    newsLink: "https://example.com/parking-flood",
    productName: "都會動態防汛車輛守護險",
    targetAudience: "居住或停車於台北、新北低窪地區地下停車場的一般自用轎車車主。",
    marketGap:
      "地下停車場淹水理賠流程繁瑣，保戶需自行舉證淹水深度與直接因果關係，往往求償困難。",
    coverageDetails:
      "1. 觸發條件：氣象局發布的自動雨量站數據超過閾值，且保戶停車地址在官方公布的易淹水潛勢區內\n2. 直接補償：車輛受損修繕費用（最高USD 15,000）\n3. 交通補助：理賠期間提供每日USD 30替代交通補助，最長30天",
    exclusions: "停放於未列管或非法改建地下空間、颱風警報前已知風險未移車。",
    businessLogic:
      "整合地政司易淹水潛勢區圖層API與氣象局自動測站數據，實現客觀觸發，免去現場勘查爭議。",
    probabilityPct: 9.0,
    expectedLossUsd: 12000,
    premiumMin: 800,
    premiumMax: 1500,
    pmDebate:
      "這是一個C端（消費者）產品，重點在於「主動通知與無爭議理賠」。我建議在LINE Pay、街口支付的車險購買流程中嵌入附加選項。",
    underwriterDebate:
      "地下停車場的深度數據難以取得，建議改採「停車格是否位於潛勢區一級警戒範圍」作為客觀核保依據。",
    actuaryDebate:
      "台北盆地地下停車場淹水事件年均3.2次，但嚴重事件（淹水超過50cm）約0.9次。年化保費USD 800-1,500，損失率約72%。",
    peril: "Typhoon Flood",
    annualFrequency: 0.9,
  },
  {
    minutesAgo: 29,
    newsTitle: "「極速安居」都會型智慧防汛綜合保險",
    newsSource: "工商時報",
    newsSummary:
      "極端降雨頻率創新高，台灣地方政府啟動智慧防洪計劃，民間保險需求急遽上升。",
    newsLink: "https://example.com/smart-flood",
    productName: "極速安居都會型智慧防汛綜合保險",
    targetAudience: "居住於台灣都市低窪地區的住宅所有人與租屋族，特別是台北、新北、高雄市區。",
    marketGap:
      "住宅水災險傳統理賠流程平均需要14天，遠超過家庭緊急資金需求的時間點。極端降雨頻率提升，但投保率仍偏低，主要原因是過去理賠體驗差。",
    coverageDetails:
      "1. 參數觸發：氣象局豪雨特報且在地政資料顯示房屋位於易淹水潛勢區\n2. 緊急生活補助：48小時內自動撥付USD 1,000緊急金\n3. 修繕理賠：最高USD 30,000，文件齊全後5工作日到帳\n4. 附加服務：免費連接智慧水位感測器（首年免費安裝）",
    exclusions: "海嘯、地震引發之海水倒灌、主觀故意損毀。",
    businessLogic:
      "與IoT廠商合作，在投保住宅安裝低功耗水位感測器，感測器數據作為客觀理賠觸發依據，徹底解決舉證困難問題。",
    probabilityPct: 11.0,
    expectedLossUsd: 25000,
    premiumMin: 1500,
    premiumMax: 2800,
    pmDebate:
      "IoT感測器附加服務是這個產品的核心差異點。投保不只是買保險，更是獲得一個智慧防災預警系統，可以大幅提升客戶黏著度與續保率。",
    underwriterDebate:
      "需要建立感測器數據的tamper-proof機制，確保數據不被人為篡改。建議引入第三方數據驗證平台。",
    actuaryDebate:
      "台灣主要都市淹水事件年均2.8次，住宅平均損失USD 25,000。加入感測器後，預計可將損失率從82%降至65%，年化保費USD 1,500-2,800合理。",
    peril: "Typhoon Flood",
    annualFrequency: 2.8,
  },
  {
    minutesAgo: 35,
    newsTitle: "安心核：都會極端降雨車輛淹水補償保險",
    newsSource: "聯合新聞網",
    newsSummary:
      "多達3000輛車在豪雨後受困基隆河沿岸，保險公司理賠排隊人龍塞滿服務中心。",
    newsLink: "https://example.com/flood-vehicles",
    productName: "安心核：都會極端降雨車輛全面補償保險",
    targetAudience: "台灣都市地區持有1-3輛自用汽車的家庭，特別是停車於露天或地面停車場者。",
    marketGap:
      "現行車輛水災理賠需要現場勘查，旺季排期動輒3-4週，保戶面臨「車無法修、出行中斷、收入受影響」的三重困境。",
    coverageDetails:
      "1. 觸發條件：氣象局發布的特定測站雨量超過閾值\n2. 即時補償：觸發後24小時內自動撥付USD 2,000應急金\n3. 修繕費用：最高USD 20,000，憑修繕工單3日撥款\n4. 代步服務：最多30天的代步車費用，每日上限USD 50",
    exclusions: "停放於已知淹水高風險區且警報發布後未移車、車輛本身機械故障。",
    businessLogic:
      "整合中央氣象局API自動計算理賠，與台灣大車隊、格上租車合作提供即時代步服務，形成完整的生態系服務。",
    probabilityPct: 14.0,
    expectedLossUsd: 18000,
    premiumMin: 1200,
    premiumMax: 2000,
    pmDebate:
      "「24小時撥付應急金」是這個產品的殺手特點。在颱風後的第一天，保戶最需要的是現金，而不是等待勘查。這個設計完全瞄準了市場痛點。",
    underwriterDebate:
      "應要求投保時上傳停車場地址，並系統性評估停車位置的淹水風險等級，對高風險地址（如基隆河旁50m內）加收30%保費。",
    actuaryDebate:
      "台灣颱風季（6-10月）車輛淹水事件年均4.2次，平均損失USD 18,000。年化保費USD 1,200-2,000，損失率約70%，符合商業標準。",
    peril: "Typhoon Flood",
    annualFrequency: 4.2,
  },
  {
    minutesAgo: 40,
    newsTitle: '跨境電商第三方金流延遲中斷綜合損失補償險',
    newsSource: 'TechCrunch',
    newsSummary: '國際清算網絡異常致數千跨境賣家資金遭凍結超過72小時，面臨斷鏈危機。',
    newsLink: 'https://example.com/crossborder-payment',
    productName: '跨境電商第三方金流延遲中斷綜合損失補償險',
    targetAudience: '使用海外第三方收付款服務之跨境電商賣家及進出口貿易商。',
    marketGap: '傳統貨運險不承保金流問題，銀行責任限額過低，缺乏即時營運資金填補方案。',
    coverageDetails: '1. 資金凍結補償：超過48小時按日撥付0.5%週轉補償金\n2. 匯損保險：凍結期間匯率變動損失\n3. 上限：USD 80,000',
    exclusions: '洗錢防制調查、商戶自願暫停、詐欺交易。',
    businessLogic: '串接Stripe/PayPal API狀態監控，觸發後自動核發流動性保險金。',
    probabilityPct: 4.2,
    expectedLossUsd: 45000,
    premiumMin: 2200,
    premiumMax: 3600,
    pmDebate: '金流延遲對中小賣家是致命傷，參數型保險能在最關鍵時刻給予流動性。',
    underwriterDebate: '須排除商戶自身因洗錢防制或違規引發之凍結。',
    actuaryDebate: '年均重大中斷約1.2次，定價USD 2,200-3,600合乎利潤模型。',
    peril: 'Payment Gateway Outage',
    annualFrequency: 1.2,
  },
  {
    minutesAgo: 45,
    newsTitle: '綠能儲能電網事故與頻率失調損失補償險',
    newsSource: 'Energy Storage News',
    newsSummary: '儲能案場電網頻率驟降導致電池管理系統保護性跳脫，損失百萬度電力售電收入。',
    newsLink: 'https://example.com/grid-frequency',
    productName: '綠能儲能電網事故與頻率失調損失補償險',
    targetAudience: '參與台電電力交易平台之儲能案場投資商與EPC營運團隊。',
    marketGap: '現有工程險與產險不保台電系統頻率異常造成的容量費扣款損失。',
    coverageDetails: '1. 容量費補償：非案場自身原因之頻率觸發違約罰金\n2. 充放電收益差額：停機期間預期收益\n3. 上限：USD 150,000',
    exclusions: '設備未定期校準、案場自行操作失誤。',
    businessLogic: '直接對接台電調度中心頻率記錄與案場SCADA系統。',
    probabilityPct: 7.5,
    expectedLossUsd: 90000,
    premiumMin: 5500,
    premiumMax: 9000,
    pmDebate: '儲能是新能源的核心，電網頻率損失險能大幅提高銀行融資意願。',
    underwriterDebate: '需驗證案場具備合格的BMS多重保護認證方可承保。',
    actuaryDebate: '依過去兩年電網事件頻率，7.5%年發生率評估合理。',
    peril: 'Grid Instability',
    annualFrequency: 1.5,
  },
  {
    minutesAgo: 50,
    newsTitle: '農業高光譜無人機巡檢失誤與災損補償險',
    newsSource: 'AgTech Weekly',
    newsSummary: '無人機光譜辨識失靈導致大面積果園錯失病蟲害黃金防治期，產量減半。',
    newsLink: 'https://example.com/ag-drone',
    productName: '農業高光譜無人機巡檢失誤與災損補償險',
    targetAudience: '智慧農業代耕隊、果樹產銷班及農業植保無人機營運商。',
    marketGap: '傳統農險只管天災，無人機演算法誤判導致之農損求償無門。',
    coverageDetails: '1. 病蟲害誤判農損差額填補\n2. 二次補植與農藥補貼\n3. 上限：USD 35,000',
    exclusions: '非認證無人機演算法、未依建議進行田間管理。',
    businessLogic: '結合農業部試驗所專家系統複核光譜日誌。',
    probabilityPct: 5.8,
    expectedLossUsd: 28000,
    premiumMin: 1400,
    premiumMax: 2400,
    pmDebate: '智慧農業服務化趨勢下，技術信任保險是推動農民採納的關鍵。',
    underwriterDebate: '演算法供應商需投保E&O（專業責任險）作為分保支撐。',
    actuaryDebate: '單一作物損失控制良好，定價USD 1,400-2,400具備承保利潤。',
    peril: 'Algorithm Failure',
    annualFrequency: 0.9,
  },
  {
    minutesAgo: 55,
    newsTitle: '遠距醫療視訊診療連線中斷與處方延誤責任險',
    newsSource: 'Digital Health Report',
    newsSummary: '遠距看診平台伺服器當機，慢性病患者延誤用藥引發急症送醫爭議。',
    newsLink: 'https://example.com/telehealth-outage',
    productName: '遠距醫療視訊診療連線中斷與處方延誤責任險',
    targetAudience: '各級診所、遠距健康諮詢平台及居家醫療照護團隊。',
    marketGap: '醫師法責任險未包含視訊軟硬體斷線導致的醫療處置中斷連帶責任。',
    coverageDetails: '1. 連線中斷延誤就醫賠償\n2. 緊急實體轉診救護車費用\n3. 上限：USD 60,000',
    exclusions: '病患未配合急診指示、未經授權醫療行為。',
    businessLogic: '通話日誌與SIP伺服器連線中斷即時通報。',
    probabilityPct: 4.8,
    expectedLossUsd: 40000,
    premiumMin: 2000,
    premiumMax: 3200,
    pmDebate: '遠距醫療蓬勃發展，平台可靠性直接影響醫療品質，本產品保障雙方。',
    underwriterDebate: '平台需有備援線路及自動簡訊通知緊急轉診機制。',
    actuaryDebate: '年均事件約0.7次，USD 2,000-3,200能覆蓋潛在賠付。',
    peril: 'Telehealth Infrastructure Failure',
    annualFrequency: 0.7,
  },
  {
    minutesAgo: 60,
    newsTitle: '半導體晶圓超低溫冷鏈運輸失溫與震動損壞險',
    newsSource: 'Semiconductor Today',
    newsSummary: '先進製程特用化學品航運過程中冷卻系統電力中斷，整批光阻劑變質報廢。',
    newsLink: 'https://example.com/wafer-coldchain',
    productName: '半導體晶圓超低溫冷鏈運輸失溫與震動損壞險',
    targetAudience: '半導體材料供應商、晶圓代工廠採購部門及專業精密物流商。',
    marketGap: '傳統貨物險理賠時程長達數月，無法滿足半導體急需補料避免停線之需求。',
    coverageDetails: '1. IoT溫度感測器超過臨界值即時自動定額賠償\n2. 緊急航空替代料件空運運費\n3. 上限：USD 500,000',
    exclusions: '包裝瑕疵、報關故意延誤。',
    businessLogic: '全程NB-IoT溫度/震動即時數據上鏈，自動比對智慧合約條件。',
    probabilityPct: 3.2,
    expectedLossUsd: 250000,
    premiumMin: 12000,
    premiumMax: 20000,
    pmDebate: '半導體停線一小時損失數百萬，快速參數型理賠是晶圓廠最渴求的。',
    underwriterDebate: '僅限使用具備航空級認證的冷鏈溫控貨櫃。',
    actuaryDebate: '單次賠付較大，需搭配再保險合約，定價維持良好安全邊際。',
    peril: 'Cold Chain Disruption',
    annualFrequency: 0.4,
  },
  {
    minutesAgo: 65,
    newsTitle: 'AI演算法偏見與歧視訴訟法律費用防衛險',
    newsSource: 'AI Ethics Monitor',
    newsSummary: '企業招募AI篩選履歷被控存在性別與年齡偏見，遭歐盟監管機構啟動集體訴訟。',
    newsLink: 'https://example.com/ai-bias',
    productName: 'AI演算法偏見與歧視訴訟法律費用防衛險',
    targetAudience: '在招募、信用評分、定價中導入AI模型的中大型企業及HR科技公司。',
    marketGap: '歐盟AI法案與美台法規趨嚴，現有法律費用險通常排除新興AI責任。',
    coverageDetails: '1. 監管機構調查抗辯律師費\n2. 第三方演算法公平性審計費用\n3. 上限：USD 100,000',
    exclusions: '經法院認定之故意歧視政策、未保留訓練數據審計軌跡。',
    businessLogic: '定期檢驗企業AI模型之公平性指標（如Disparate Impact Ratio）。',
    probabilityPct: 6.5,
    expectedLossUsd: 70000,
    premiumMin: 4000,
    premiumMax: 6800,
    pmDebate: 'AI法規合規壓力巨大，此保險能成為企業AI治理框架的最佳安全網。',
    underwriterDebate: '投保時需出具模型可解釋性報告與訓練集去偏見措施。',
    actuaryDebate: '歐美訴訟案例上升，定價USD 4,000-6,800符合訴訟成本精算。',
    peril: 'Regulatory Investigation',
    annualFrequency: 1.1,
  },
  {
    minutesAgo: 70,
    newsTitle: '再生能源憑證（T-REC）綠電轉供延遲履約保證險',
    newsSource: 'ESG Today',
    newsSummary: '風電案場併網進度受海洋氣象影響延宕，致購電企業錯失RE100年度合規期限。',
    newsLink: 'https://example.com/trec-delay',
    productName: '再生能源憑證（T-REC）綠電轉供延遲履約保證險',
    targetAudience: '簽署CPPA（企業購電協議）之科技製造業、RE100承諾企業及售電業者。',
    marketGap: '綠電轉供延遲產生的合規替代成本（需加價購買高價現貨憑證）無合適保險商品。',
    coverageDetails: '1. 替代綠電現貨價差補償\n2. 監管合規逾期罰款填補\n3. 上限：USD 120,000',
    exclusions: '企業故意解約、未取得施工許可之案場。',
    businessLogic: '對接國家再生能源憑證中心申報日誌，自動監控轉供時程。',
    probabilityPct: 8.0,
    expectedLossUsd: 85000,
    premiumMin: 5000,
    premiumMax: 8200,
    pmDebate: '企業買綠電最怕案場跳票，履約保證險能大幅加速CPPA綠電簽約。',
    underwriterDebate: '要求案場EPC廠商提供第三方法律與工程完工履約保證。',
    actuaryDebate: '離岸風電與光電工期平均延宕3.2個月，模型定價精確。',
    peril: 'Project Delay',
    annualFrequency: 1.3,
  },
  {
    minutesAgo: 75,
    newsTitle: '工業智慧電網韌性與防駭干擾運轉損失保險',
    newsSource: 'Industrial Cyber',
    newsSummary: '精密機械園區微電網遭受未知APT組織工控協定勒索攻擊，產線緊急停機。',
    newsLink: 'https://example.com/smart-grid-cyber',
    productName: '工業智慧電網韌性與防駭干擾運轉損失保險',
    targetAudience: '科學園區高科技廠、智慧工廠微電網營運商、精密重工業。',
    marketGap: 'OT工控系統遭受資安攻擊時，電力不穩造成的精密模具與晶圓報廢無專屬保障。',
    coverageDetails: '1. 機台急停造成的原料報廢損失\n2. 工控系統緊急鑑識與修復\n3. 上限：USD 200,000',
    exclusions: '使用明令淘汰之不安全協定（如無加密Modbus）、內部破壞。',
    businessLogic: '結合OT網路異常流量偵測器，偵測到工控指令異常自動備份日誌存證。',
    probabilityPct: 5.2,
    expectedLossUsd: 130000,
    premiumMin: 7500,
    premiumMax: 13000,
    pmDebate: 'IT與OT邊界融合讓工控安全成為兵家必爭之地，製造大國必備。',
    underwriterDebate: '必須實施IEC 62443工控安全標準，並完成每半年弱點掃描。',
    actuaryDebate: '考量OT攻擊頻率與極端損失，USD 7,500-13,000定價可達目標賠付率。',
    peril: 'OT Cyber Attack',
    annualFrequency: 0.8,
  },
  {
    minutesAgo: 80,
    newsTitle: '國際碳權抵換查驗不通過與註銷損失險',
    newsSource: 'Carbon Pulse',
    newsSummary: 'Verra國際查驗機構推翻前期林業碳匯項目，致數家企業碳中和抵換額度遭作廢。',
    newsLink: 'https://example.com/carbon-credit-void',
    productName: '國際碳權抵換查驗不通過與註銷損失險',
    targetAudience: '購買自願性碳權進行碳中和宣告之跨國企業、碳資產管理公司。',
    marketGap: '碳權註銷或查驗翻盤帶來的財務損失與商譽危機，目前完全無保險可解。',
    coverageDetails: '1. 被作廢碳權之重置成本全額賠償\n2. 應急購買合規碳權差價\n3. 上限：USD 90,000',
    exclusions: '碳權專案發起方涉及詐欺罪定讞、非主流註冊平台碳權。',
    businessLogic: '即時監控Verra/Gold Standard registry API異動日誌。',
    probabilityPct: 7.0,
    expectedLossUsd: 65000,
    premiumMin: 3800,
    premiumMax: 6500,
    pmDebate: '全球碳交易市場發展最欠缺的就是履約信心，此產品為碳市場注入活水。',
    underwriterDebate: '僅限承保金標（Gold Standard）或VCS評級A級以上之專案。',
    actuaryDebate: '林業專案翻盤率約6-8%，定價USD 3,800-6,500符合歷史賠付經驗。',
    peril: 'Carbon Credit Revocation',
    annualFrequency: 1.1,
  },
  {
    minutesAgo: 85,
    newsTitle: '生成式AI Deepfake偽造高管聲音詐騙即時補償險',
    newsSource: 'Fintech Security Review',
    newsSummary: '跨國分公司財務長接獲CEO即時合成聲音視訊指令，電匯800萬款項至詐騙帳戶。',
    newsLink: 'https://example.com/deepfake-fraud',
    productName: '生成式AI Deepfake偽造高管聲音詐騙即時補償險',
    targetAudience: '設有海外分支機構之跨國企業、大型家族辦公室及私立大學財務處。',
    marketGap: '傳統商業詐欺險（Commercial Crime Policy）要求複雜法律調查，無法立即填補受騙資金。',
    coverageDetails: '1. 報案48小時內先行墊付50%受騙損失\n2. 數位鑑識與聲紋AI檢測費用\n3. 上限：USD 100,000',
    exclusions: '未執行雙人授權複核程序、內部員工串謀詐欺。',
    businessLogic: '與聲紋防偽辨識引擎合作，將通話錄音特徵值上鏈核對。',
    probabilityPct: 9.5,
    expectedLossUsd: 80000,
    premiumMin: 4500,
    premiumMax: 7800,
    pmDebate: 'AI詐騙防不勝防，雙人複核加保險兜底是現代企業財務內控的黃金標準。',
    underwriterDebate: '企業內部必須具有明確的超過USD 10,000款項之第二管道確認SOP。',
    actuaryDebate: '近年Deepfake詐騙呈指數型成長，適當提高免賠額能有效控制賠付。',
    peril: 'Deepfake Social Engineering',
    annualFrequency: 1.9,
  },
  {
    minutesAgo: 90,
    newsTitle: '都會微氣候無人機配送抗風耐雨保險',
    newsSource: 'Logistics Tech',
    newsSummary: '強烈側風導致外送無人機失控墜毀於住宅區屋頂，貨損及民事賠償責任高昂。',
    newsLink: 'https://example.com/drone-delivery-weather',
    productName: '都會微氣候無人機配送抗風耐雨保險',
    targetAudience: '無人機物流營運商、生鮮外送平台、高價值醫療檢體快遞團隊。',
    marketGap: '傳統第三責任險不保特定風速以上的飛行意外，物流商承擔巨額自負額。',
    coverageDetails: '1. 無人機本體全損賠償\n2. 運送貨品毀損或失溫補償\n3. 第三方地面財損及人身責任\n4. 上限：USD 50,000',
    exclusions: '超過機型設計極限飛行、未經民航局核准航線。',
    businessLogic: '整合無人機黑盒子日誌與微氣象雷達資訊自動定責。',
    probabilityPct: 8.0,
    expectedLossUsd: 35000,
    premiumMin: 1800,
    premiumMax: 3000,
    pmDebate: '無人機配送最後一哩路的最大障礙就是極端天氣風險，保險可為規模化鋪平道路。',
    underwriterDebate: '要求機隊配備即時備援降落傘與自動避障系統。',
    actuaryDebate: '年均因風雨迫降率約8%，定價USD 1,800-3,000合理。',
    peril: 'Micro-climate Severe Weather',
    annualFrequency: 1.4,
  }];

// ── build run summaries and records ──────────────────────────────────────────

const DATA_20 = RUN_DATA.slice(0, 20);

export const MOCK_RUN_SUMMARIES: RunSummary[] = DATA_20.map((d, i) => {
  const id = i === 0 ? "foresure-20260905-2e27fc30" : stampId(d.minutesAgo);
  return {
    decision_id: id,
    run_id: `run-${id}`,
    timestamp: ts(d.minutesAgo),
    news_title: d.newsTitle,
    product_name: d.productName,
    is_mock_proposal: false,
    grounding_status: i === 0 ? "warn" : "pass",
    chain_is_mock: true,
    tx_hash: null,
    verification_url: null,
  };
});

export const MOCK_RUN_RECORDS: RunRecord[] = DATA_20.map((d, i) => {
  const summary = MOCK_RUN_SUMMARIES[i];
  return {
    decision_id: summary.decision_id,
    run_id: summary.run_id ?? undefined,
    timestamp: summary.timestamp,
    news: {
      title: d.newsTitle,
      link: d.newsLink,
      published: ts(d.minutesAgo + 30),
      summary: d.newsSummary,
      source: d.newsSource,
      is_mock: false,
    },
    matched_products:
      i === 0
        ? [
            {
              id: "P-1",
              name: "網路資安險",
              category: "Liability",
              description: "涵蓋企業資安風險及外部駭客入侵",
              distance: 0.18,
            },
            {
              id: "P-2",
              name: "重大疾病險",
              category: "Health",
              description: "特定重疾與急難救助",
              distance: 0.22,
            },
            {
              id: "P-3",
              name: "外送員碎片化保險",
              category: "Accident",
              description: "按單按時段計費之碎片化意外保障",
              distance: 0.25,
            },
            {
              id: "P-4",
              name: "綁架與勒索險 (K&R)",
              category: "Liability",
              description: "高風險人身安全與贖金談判費用補償",
              distance: 0.29,
            },
            {
              id: "P-5",
              name: "農業保險 (氣候參數型)",
              category: "Property",
              description: "極端降雨或乾旱指數型自動給付機制",
              distance: 0.33,
            },
          ]
        : [
            {
              id: `P-${i * 3 + 1}`,
              name: "企業財產綜合保險",
              category: "Property",
              description: "涵蓋企業資產之各類風險損失",
              distance: 0.18,
            },
            {
              id: `P-${i * 3 + 2}`,
              name: "營業中斷保險",
              category: "Business Interruption",
              description: "保障因意外事故造成的營業停頓損失",
              distance: 0.24,
            },
            {
              id: `P-${i * 3 + 3}`,
              name: "責任保險",
              category: "Liability",
              description: "涵蓋第三方損害賠償責任",
              distance: 0.31,
            },
          ],
    actuarial_data: {
      probability_pct: d.probabilityPct,
      expected_loss_usd: d.expectedLossUsd,
      premium_range_usd: [d.premiumMin, d.premiumMax],
      markup_multiplier: [1.3, 1.6],
      basis: {
        peril: d.peril,
        probability_source: "assumption",
        probability_method: "Poisson frequency model",
        annual_frequency: d.annualFrequency,
        loss_source: "assumption",
        loss_method: "assumption",
      },
    },
    proposal_data: {
      source_news: d.newsTitle,
      news_summary: d.newsSummary,
      news_link: d.newsLink,
      actuarial_data: {
        probability_pct: d.probabilityPct,
        expected_loss_usd: d.expectedLossUsd,
        premium_range_usd: [d.premiumMin, d.premiumMax],
        markup_multiplier: [1.3, 1.6],
      },
      debate: { pm: d.pmDebate, underwriter: d.underwriterDebate },
      proposal: {
        product_name: d.productName,
        target_audience: d.targetAudience,
        market_gap: d.marketGap,
        coverage_details: d.coverageDetails,
        exclusions: d.exclusions,
        business_logic: d.businessLogic,
      },
      is_mock: false,
      model: "gemini-3.5-flash-lite",
    },
    blockchain_receipt: {
      decision_id: summary.decision_id,
      payload: {},
      data_hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      blockchain_tx_hash: null,
      block_number: null,
      verification_url: null,
      network: "mock",
      is_mock: true,
      timestamp: summary.timestamp,
    },
    report_path: `reports/${summary.decision_id}.json`,
    grounding: i === 0
      ? {
          status: "warn",
          checker_version: "grounding-check/v1",
          checked_claims: 3,
          grounded_claims: 2,
          flag_count: 1,
          evidence_sources: ["actuarial_engine", "news", "matched_products"],
          flags: [
            {
              type: "missing_disclosure",
              severity: "medium",
              field: "business_logic",
              value: null,
              excerpt: "",
              message: "精算數字含假設值，但提案未揭露「假設」或「估計」",
            },
          ],
        }
      : {
          status: "pass",
          checker_version: "grounding-check/v1",
          checked_claims: 3,
          grounded_claims: 3,
          flag_count: 0,
          evidence_sources: ["actuarial_engine", "news", "matched_products"],
          flags: [],
        },
  };
});
