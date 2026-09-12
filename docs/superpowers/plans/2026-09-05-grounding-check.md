# Grounding Check（幻覺檢測）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在多代理人辯論產出提案之後、產報告與上鏈之前，對提案做一次純規則、不呼叫 LLM、離線可重現的幻覺檢測，結論隨報告與鏈上 payload 一起封存，並在前端以徽章與標記清單呈現。

**Architecture:** 新模組 `grounding_check.py` 只做純函式（輸入提案、精算數據、新聞、既有商品 → 輸出 `{status, flags, ...}`），`main.run_pipeline` 在 `actuary` 之後呼叫它並發出新的 SSE 事件 `grounding`，結果同時掛在 `proposal_data["grounding"]`（給 Word 報告與 `build_decision_payload`）和 `record["grounding"]`（給歷史紀錄與前端）。前端把 `grounding` 加進 `Stage`、`STAGES`、reducer 與型別，新增 `GroundingBadge` 徽章與稽核分頁的標記清單。

**Tech Stack:** Python 3.12（`./venv/bin/python`）、pytest、python-docx；Next.js 16 + React 19 + TypeScript + vitest；契約文件 `docs/API.md`。

**Spec:** 本計畫第「設計摘要」節即規格。構想來源是雲端 routine 的第一次執行（https://claude.ai/code/session_01TYRBDjyxibB7SvpHXuE2m3 ，它做的 patch 推不上 GitHub，所以這裡重寫成可執行的計畫，設計依現在的 main 調整）。

## Global Constraints

- 後端指令一律用 `./venv/bin/python`；測試指令 `./venv/bin/python -m pytest -q`。
- 前端在 `frontend/`：`npm test`（vitest）、`npm run lint`、`npm run build`（`output: "export"` 靜態匯出必須成功）。
- 每個 Task 結尾都要 commit；commit 訊息全英文、作者 `wenn00`、**不要加 Co-Authored-By**。指令格式：`git -c user.name=wenn00 commit -m "..."`。
- 只 `git add` 自己改的檔案，不要 `git add -A`（同一個工作目錄可能有另一個 session 在改前端）。
- 後端 8080 的 uvicorn 沒開 `--reload`，後端 commit 之後要手動重啟才會生效：`./venv/bin/uvicorn apigee_target:app --port 8080 --log-level info`。
- 不呼叫 LLM、不加新的付費服務、不加新的 Python 或 npm 依賴。
- 舊紀錄（沒有 `grounding` 欄位）在後端與前端都必須能正常顯示。
- i18n 字典每個 key 中英文都要有（`frontend/src/lib/__tests__/i18n.test.ts` 會檢查對稱）。
- 鏈上驗證用的是存下來的 `blockchain_receipt.payload`（`apigee_target.verify_run`），不是重組，所以 payload 加欄位不影響舊紀錄的驗證。

---

## 設計摘要（規格）

### 為什麼

國泰公開強調的五項 AI 落地標準是：來源可追溯、幻覺檢測、人審、稽核軌跡、紅隊測試。專案目前有來源可追溯（`basis`）、稽核軌跡（上鏈）、人審（提案是內部草稿）；幻覺檢測是空的。實測 mock 提案的 `business_logic` 寫「保費利潤率預期可達 35%」，這個 35% 沒有任何來源，正是評審會抓的東西。

### 檢查三件事

| 標記類型 `type` | 嚴重度 | 規則 |
|---|---|---|
| `unsupported_number` | high | `market_gap`、`business_logic` 兩個「風險與定價敘述」欄位裡出現的數字，必須能對回精算引擎輸出（含 `basis` 內所有數值）、新聞標題與摘要、或比對到的既有商品名稱與描述，容許 2% 相對誤差（讓 0.6129 → 0.61、14,447,368 → 1,444 萬 都算接地），百分比與小數互換也算（61% 對 0.6129）。`coverage_details` 與 `exclusions` 是商品設計參數（保額、天數、門檻），不是對世界的宣稱，不檢查。 |
| `unverified_citation` | high | 六個提案欄位裡「根據 X 統計／資料／報告」「X 統計顯示」形式的引用，X 必須真的出現在本次證據文字（`basis` 的來源字串、新聞、既有商品）裡；「精算引擎」「本提案」等自我指涉不算引用。 |
| `missing_disclosure` | medium | `basis` 存在且 `probability_source == "assumption"` 或 `loss_source == "assumption"`（目前 `loss_source` 永遠是 assumption）時，`market_gap` 加 `business_logic` 必須出現「假設」「估計」「初估」「假定」「推估」「estimate」「assum」其中之一。沒有 `basis` 的舊紀錄不要求。 |

數字擷取規則：支援千分位、小數、`萬`／`億`／`千`／`K`／`M`／`B` 倍數、`%`；跳過行首清單編號（`1.`、`2、`）、1900 到 2100 的四位數年份、小於 10 且非百分比非小數的整數（「3 日」）、以及後面緊接時間或計數單位的數字（`日 天 小時 分鐘 月 週 年 次 人 家 個 項 級 期 季 倍`，例如「24 小時」）。

### 結論

`status`：有任何 high 標記為 `fail`；只有 medium 為 `warn`；沒有標記為 `pass`。

### 輸出格式（`grounding` 物件，SSE、紀錄、攤平格式三處相同）

```json
{
  "status": "fail",
  "checker_version": "grounding-check/v1",
  "checked_claims": 3,
  "grounded_claims": 2,
  "flag_count": 1,
  "evidence_sources": ["actuarial_engine", "news", "matched_products"],
  "flags": [
    {
      "type": "unsupported_number",
      "severity": "high",
      "field": "business_logic",
      "value": "35%",
      "excerpt": "透過再保險分散風險，保費利潤率預期可達 35%。",
      "message": "「35%」對不回精算引擎輸出、新聞原文或既有商品資料"
    }
  ]
}
```

### 落點

- SSE 新事件 `grounding`，插在 `actuary` 之後、`report` 之前（事件總數 12 加 `error`）。
- `GET /api/v1/runs/{decision_id}` 完整紀錄新增頂層 `grounding`；`GET /api/v1/runs` 摘要新增 `grounding_status`（`"pass" | "warn" | "fail" | null`）。
- 上鏈 payload 新增 `grounding_status`、`grounding_flag_count`、`grounding_checker_version`，`agent_pipeline_version` 升為 `v1.5.0`。這樣事後不能宣稱「當時檢查是過的」。
- Word 報告新增第 4 節「幻覺檢測 / Grounding Check」。
- 前端：進度條多一段「幻覺檢測」；提案卡右上角與決策詳情標題列出現 `GroundingBadge`（通過綠、警示琥珀、未通過紅，含標記數）；「證據與稽核」分頁列出每一項標記；佇列與歷史列表在 warn／fail 時顯示徽章。

### 分工建議

Task 1 到 6 是後端（互相依序），Task 7 到 9 是前端（只依賴本節的契約，可以與後端平行進行），Task 10 是整合驗證。

---

## File Structure

| 檔案 | 動作 | 責任 |
|---|---|---|
| `grounding_check.py` | 新增 | 純函式：數字擷取、證據語料、三條規則、結論 |
| `tests/test_grounding_check.py` | 新增 | 規則的單元測試 |
| `main.py` | 修改 | 呼叫檢查、發 `grounding` 事件、存進 `proposal_data` 與 `record` |
| `tests/test_pipeline_events.py` | 修改 | 事件順序加 `grounding`、結果有存下來 |
| `chain_writer.py` | 修改 | `build_decision_payload` 封存結論 |
| `tests/test_chain_writer.py` | 修改 | payload 含結論、無結論時為 null、竄改結論會改變雜湊 |
| `run_store.py` | 修改 | `flatten_report` 加 `grounding`、`summarize` 加 `grounding_status` |
| `tests/test_run_store.py` | 修改 | 兩個格式都能容忍缺欄 |
| `report_generator.py` | 修改 | 第 4 節幻覺檢測 |
| `tests/test_report_generator.py` | 修改 | 報告列出結論與每項標記；沒有結論時不出現該節 |
| `docs/API.md` | 修改 | SSE 表、紀錄格式、新節「幻覺檢測」 |
| `frontend/src/lib/types.ts` | 修改 | `Grounding`、`GroundingFlag`、`GroundingStatus`、`Stage` 加 `grounding`、`RunRecord.grounding`、`RunSummary.grounding_status` |
| `frontend/src/lib/stages.ts` | 修改 | `STAGES` 插入 `grounding` |
| `frontend/src/lib/i18n.tsx` | 修改 | `stage.grounding` 與 `grounding.*` 中英文 |
| `frontend/src/lib/runReducer.ts` | 修改 | state 加 `grounding`，處理事件 |
| `frontend/src/lib/__tests__/runReducer.test.ts` | 修改 | `grounding` 事件進 state、進度前進 |
| `frontend/src/lib/grounding.ts` | 新增 | `groundingTone`、`flagTypeKey` 純函式 |
| `frontend/src/lib/__tests__/grounding.test.ts` | 新增 | 純函式測試 |
| `frontend/src/components/GroundingBadge.tsx` | 新增 | 徽章與標記清單 |
| `frontend/src/app/page.tsx` | 修改 | 即時執行右欄顯示徽章 |
| `frontend/src/components/DecisionDetail.tsx` | 修改 | 標題列徽章、稽核分頁標記清單 |
| `frontend/src/components/RunQueue.tsx`、`HistorySection.tsx` | 修改 | 摘要徽章 |
| `frontend/src/lib/mockEvents.ts`、`mockData.ts` | 修改（選做） | 離線 demo 也有 `grounding` |

---

### Task 1: `grounding_check.py` 純規則檢查器

**Files:**
- Create: `grounding_check.py`
- Test: `tests/test_grounding_check.py`

**Interfaces:**
- Consumes: `proposal_data["proposal"]`（六個中文欄位）、`proposal_data["actuarial_data"]`（含 `basis`）、`news`（`{title, summary, source?}`）、`matched_products`（`[{id, name, category, description, distance}]`）。
- Produces: `check_grounding(proposal_data: dict, news: dict | None, matched_products: list[dict] | None) -> dict`，回傳格式見「設計摘要」。常數 `CHECKER_VERSION = "grounding-check/v1"`。輔助函式 `extract_numbers(text: str) -> list[tuple[float, str]]` 也匯出（Task 1 的測試會用）。

- [ ] **Step 1: 寫失敗的測試**

建立 `tests/test_grounding_check.py`：

```python
import grounding_check as gc

ACTUARIAL = {
    "probability_pct": 51.61,
    "expected_loss_usd": 14447368.42,
    "premium_range_usd": [15938709.68, 26564516.13],
    "markup_multiplier": [1.8, 3.0],
    "basis": {
        "peril": "typhoon",
        "probability_source": "內政部消防署 臺灣地區天然災害損失統計表 1958-2025 (https://www.nfa.gov.tw/cht/index.php?code=list&ids=233)",
        "probability_source_en": "National Fire Agency, Ministry of the Interior: Natural Disaster Loss Statistics for Taiwan 1958-2025",
        "loss_source": "assumption",
        "annual_frequency": 0.6129,
        "years_observed": 31,
        "events_observed": 151,
        "severe_events_observed": 19,
        "mean_households_per_severe_event": 308.21,
        "assumed_loss_per_household_usd": 46875.0,
    },
}
NEWS = {"title": "颱風重創南部 逾3000戶淹水", "summary": "農損初估8億元", "source": "測試報"}
PRODUCTS = [{"id": "INS-016", "name": "農業保險", "category": "Property",
             "description": "承保颱風造成之農作物損失，最高保額 500 萬", "distance": 0.3}]


def _proposal(**overrides):
    fields = {
        "product_name": "颱風參數險",
        "target_audience": "南部農漁業",
        "market_gap": "現有商品需人工勘損。",
        "coverage_details": "1. 降雨量連續 3 日超過 500mm 自動理賠 100萬。",
        "exclusions": "1. 人為蓄意破壞。",
        "business_logic": "依據精算引擎，年發生機率約 51.6%，單次損失約 1,444 萬美元，屬假設值。",
    }
    fields.update(overrides)
    return {"proposal": fields, "actuarial_data": ACTUARIAL}


def _check(**overrides):
    return gc.check_grounding(_proposal(**overrides), NEWS, PRODUCTS)


def test_numbers_matching_the_actuarial_engine_are_grounded():
    result = _check()
    assert result["status"] == "pass"
    assert result["checked_claims"] == 2 and result["grounded_claims"] == 2
    assert result["flags"] == []


def test_percent_claim_matches_a_fraction_in_the_basis():
    result = _check(business_logic="嚴重颱風年頻率約 61%，屬假設值。")
    assert result["status"] == "pass"
    assert result["grounded_claims"] == 1


def test_unsupported_number_in_business_logic_fails():
    result = _check(business_logic="透過再保險分散風險，保費利潤率預期可達 35%，其餘屬假設值。")
    assert result["status"] == "fail"
    assert result["flag_count"] == 1
    flag = result["flags"][0]
    assert flag["type"] == "unsupported_number" and flag["severity"] == "high"
    assert flag["field"] == "business_logic" and flag["value"] == "35%"
    assert "35%" in flag["excerpt"]


def test_numbers_from_news_and_matched_products_count_as_evidence():
    result = _check(market_gap="新聞指出逾3000戶淹水、農損 8億元；既有農業保險最高保額 500 萬，不足以覆蓋。")
    assert result["status"] == "pass"
    # 3 numbers here (news x2, matched product x1) plus the 2 in the default business_logic
    assert result["checked_claims"] == 5 and result["grounded_claims"] == 5


def test_design_parameters_in_coverage_and_exclusions_are_not_checked():
    result = _check(coverage_details="每日補償 5000 美金，最高 250,000 美金。", exclusions="投保後 30 天內之事故。")
    assert result["status"] == "pass"
    assert result["checked_claims"] == 2  # only the two numbers in the default business_logic


def test_list_markers_years_and_unit_counts_are_ignored():
    result = _check(market_gap="1. 2025 年起需 24 小時內出險\n2. 等待期 60 天\n3. 三個月內")
    assert result["status"] == "pass"
    assert result["checked_claims"] == 2  # still only the default business_logic numbers


def test_fabricated_citation_fails():
    result = _check(market_gap="根據世界銀行統計，農損逐年上升。")
    assert result["status"] == "fail"
    flag = result["flags"][0]
    assert flag["type"] == "unverified_citation" and flag["value"] == "世界銀行"
    assert flag["field"] == "market_gap"


def test_citation_of_a_real_source_passes():
    result = _check(market_gap="根據內政部消防署統計，嚴重颱風每年約 0.61 次。")
    assert result["status"] == "pass"
    assert result["flags"] == []


def test_missing_disclosure_warns_when_figures_rest_on_assumptions():
    result = _check(business_logic="年發生機率約 51.6%，單次損失約 1,444 萬美元。")
    assert result["status"] == "warn"
    assert [f["type"] for f in result["flags"]] == ["missing_disclosure"]
    assert result["flags"][0]["severity"] == "medium"


def test_legacy_actuarial_without_basis_is_not_asked_to_disclose():
    data = _proposal(business_logic="年發生機率約 51.6%。")
    data["actuarial_data"] = {"probability_pct": 51.61, "expected_loss_usd": 1.0, "premium_range_usd": [1, 2]}
    result = gc.check_grounding(data, NEWS, PRODUCTS)
    assert result["status"] == "pass"


def test_missing_news_and_products_are_tolerated():
    result = gc.check_grounding(_proposal(), None, None)
    assert result["status"] == "pass"
    assert result["evidence_sources"] == ["actuarial_engine"]


def test_result_is_deterministic_and_versioned():
    assert _check() == _check()
    result = _check()
    assert result["checker_version"] == gc.CHECKER_VERSION == "grounding-check/v1"
    assert result["evidence_sources"] == ["actuarial_engine", "news", "matched_products"]


def test_extract_numbers_handles_separators_scales_and_percent():
    values = [v for v, _ in gc.extract_numbers("損失 1,444 萬美元、機率 51.6%、農損 8億元、預算 14.4M")]
    assert values == [14_440_000.0, 51.6, 800_000_000.0, 14_400_000.0]
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `./venv/bin/python -m pytest -q tests/test_grounding_check.py`
Expected: 收集階段就錯，`ModuleNotFoundError: No module named 'grounding_check'`。

- [ ] **Step 3: 實作 `grounding_check.py`**

```python
"""幻覺檢測／數字接地檢查（grounding check）。

在多代理人辯論產出提案之後、產報告與上鏈之前，對提案做一次純規則、不呼叫 LLM、
離線可重現的檢查（同樣輸入必得同樣輸出）：

1. unsupported_number（high）：market_gap 與 business_logic 裡的數字，必須對得回精算引擎輸出、
   新聞原文或既有商品資料。coverage_details 與 exclusions 是商品設計參數，不受檢。
2. unverified_citation（high）：「根據 X 統計」的 X 必須出現在本次證據文字裡。
3. missing_disclosure（medium）：精算數字含假設值時，敘述必須揭露「假設」或「估計」。

結論 status：有 high 為 fail、只有 medium 為 warn、無標記為 pass。
"""
from __future__ import annotations

import re

CHECKER_VERSION = "grounding-check/v1"
NUMBER_TOLERANCE = 0.02  # 讓 LLM 四捨五入（0.6129 → 0.61、14,447,368 → 1,444 萬）仍算接地

CLAIM_FIELDS = ("market_gap", "business_logic")
CITATION_FIELDS = ("market_gap", "target_audience", "coverage_details", "exclusions", "business_logic")
DISCLOSURE_KEYWORDS = ("假設", "估計", "初估", "假定", "推估", "estimate", "assum")
_SELF_REFERENCES = ("精算引擎", "本模型", "本提案", "上述", "以上", "內部", "本公司", "我們")
_UNIT_SKIP = ("日", "天", "小時", "分鐘", "月", "週", "年", "次", "人", "家", "個", "項", "級", "期", "季", "倍")
_SCALE = {"萬": 1e4, "億": 1e8, "千": 1e3, "k": 1e3, "K": 1e3, "M": 1e6, "B": 1e9}

_LIST_MARKER_RE = re.compile(r"(?m)^\s*\d+[.、)．]\s*")
_NUMBER_RE = re.compile(
    r"(?<![\w.])"                    # 不接在字母、數字或小數點後面
    r"(\d{1,3}(?:,\d{3})+|\d+)"      # 整數部分，可含千分位
    r"(?:\.(\d+))?"                  # 小數部分
    r"\s*(萬|億|千|[kKMB])?"         # 中文或 SI 倍數
    r"\s*(%|％)?"                    # 百分比
    r"\s*([^\s\d,.%％]?)"            # 後面緊接的那個字，用來判斷單位
)
_CITATION_RES = (
    re.compile(r"(?:根據|依據|參考)\s*([^，。；,;：:\n]{2,40}?)(?:的)?(?:統計|資料|數據|報告|研究|調查)"),
    re.compile(r"([^，。；,;：:\n\s]{2,30}?)(?:統計顯示|數據顯示|報告指出|研究指出|資料顯示)"),
)


def extract_numbers(text: str) -> list[tuple[float, str]]:
    """回傳 (數值, 原文片段)。跳過清單編號、年份、小於 10 的計數、以及接著時間或計數單位的數字。"""
    results: list[tuple[float, str]] = []
    cleaned = _LIST_MARKER_RE.sub("", text or "")
    for m in _NUMBER_RE.finditer(cleaned):
        integer, decimal, scale, pct, following = m.groups()
        value = float(f"{integer.replace(',', '')}.{decimal}" if decimal else integer.replace(",", ""))
        if scale:
            value *= _SCALE[scale]
        is_plain_int = not decimal and not scale and not pct
        if is_plain_int and len(integer) == 4 and 1900 <= value <= 2100:
            continue  # 年份
        if is_plain_int and value < 10:
            continue  # 「3 日」這類描述用語
        if is_plain_int and following in _UNIT_SKIP:
            continue  # 「24 小時」「60 天」
        end = m.end(4) if pct else m.end(3) if scale else m.end(2) if decimal else m.end(1)
        raw = cleaned[m.start(): end].strip()  # 數字＋倍數＋百分比原樣切出，不含後面判斷單位用的那個字
        results.append((value, raw))
    return results


def _walk_numbers(obj) -> list[float]:
    if isinstance(obj, bool):
        return []
    if isinstance(obj, (int, float)):
        return [float(obj)]
    if isinstance(obj, dict):
        return [n for v in obj.values() for n in _walk_numbers(v)]
    if isinstance(obj, (list, tuple)):
        return [n for v in obj for n in _walk_numbers(v)]
    return []


def _corpus_numbers(actuarial: dict, news: dict | None, products: list[dict] | None) -> list[float]:
    numbers = _walk_numbers(actuarial)
    for text in _evidence_texts(news, products):
        numbers.extend(v for v, _ in extract_numbers(text))
    return numbers


def _evidence_texts(news: dict | None, products: list[dict] | None) -> list[str]:
    texts: list[str] = []
    if news:
        texts.extend(str(news.get(k) or "") for k in ("title", "summary", "source"))
    for p in products or []:
        texts.extend(str(p.get(k) or "") for k in ("name", "description"))
    return texts


def _corpus_text(actuarial: dict, news: dict | None, products: list[dict] | None) -> str:
    basis = actuarial.get("basis") or {}
    parts = [str(basis.get(k) or "") for k in
             ("probability_source", "probability_source_en", "probability_method", "loss_method", "assumed_loss_note")]
    parts.extend(_evidence_texts(news, products))
    return re.sub(r"\s+", "", " ".join(parts))


def _is_grounded(value: float, corpus: list[float]) -> bool:
    for c in corpus:
        for candidate in (value, value / 100, value * 100):
            if abs(candidate - c) <= NUMBER_TOLERANCE * max(abs(c), 1e-9):
                return True
    return False


def _cited_entities(text: str) -> list[str]:
    entities = []
    for pattern in _CITATION_RES:
        for m in pattern.finditer(text or ""):
            entity = m.group(1).strip()
            if entity and not any(ref in entity for ref in _SELF_REFERENCES):
                entities.append(entity)
    return entities


def _excerpt(text: str, needle: str, width: int = 24) -> str:
    pos = (text or "").find(needle)
    if pos < 0:
        return (text or "")[: width * 2]
    return text[max(0, pos - width): pos + len(needle) + width].strip()


def check_grounding(proposal_data: dict, news: dict | None, matched_products: list[dict] | None) -> dict:
    proposal = proposal_data.get("proposal") or {}
    actuarial = proposal_data.get("actuarial_data") or {}
    corpus_numbers = _corpus_numbers(actuarial, news, matched_products)
    corpus_text = _corpus_text(actuarial, news, matched_products)
    flags: list[dict] = []
    checked = grounded = 0

    for field in CLAIM_FIELDS:
        text = proposal.get(field) or ""
        for value, raw in extract_numbers(text):
            checked += 1
            if _is_grounded(value, corpus_numbers):
                grounded += 1
                continue
            flags.append({
                "type": "unsupported_number", "severity": "high", "field": field, "value": raw,
                "excerpt": _excerpt(text, raw),
                "message": f"「{raw}」對不回精算引擎輸出、新聞原文或既有商品資料",
            })

    for field in CITATION_FIELDS:
        text = proposal.get(field) or ""
        for entity in _cited_entities(text):
            if re.sub(r"\s+", "", entity) in corpus_text:
                continue
            flags.append({
                "type": "unverified_citation", "severity": "high", "field": field, "value": entity,
                "excerpt": _excerpt(text, entity),
                "message": f"引用的來源「{entity}」不在本次證據（精算依據、新聞、既有商品）中",
            })

    basis = actuarial.get("basis") or {}
    rests_on_assumption = basis.get("probability_source") == "assumption" or basis.get("loss_source") == "assumption"
    if basis and rests_on_assumption:
        narrative = " ".join(proposal.get(f) or "" for f in CLAIM_FIELDS).lower()
        if not any(k.lower() in narrative for k in DISCLOSURE_KEYWORDS):
            flags.append({
                "type": "missing_disclosure", "severity": "medium", "field": "business_logic", "value": None,
                "excerpt": "", "message": "精算數字含假設值，但提案未揭露「假設」或「估計」",
            })

    if any(f["severity"] == "high" for f in flags):
        status = "fail"
    elif flags:
        status = "warn"
    else:
        status = "pass"

    sources = ["actuarial_engine"] if actuarial else []
    if news:
        sources.append("news")
    if matched_products:
        sources.append("matched_products")
    return {
        "status": status,
        "checker_version": CHECKER_VERSION,
        "checked_claims": checked,
        "grounded_claims": grounded,
        "flag_count": len(flags),
        "evidence_sources": sources,
        "flags": flags,
    }
```

- [ ] **Step 4: 跑測試確認通過**

Run: `./venv/bin/python -m pytest -q tests/test_grounding_check.py`
Expected: `13 passed`。若 `test_extract_numbers_handles_separators_scales_and_percent` 失敗，先印 `gc.extract_numbers(...)` 看哪個 token 的 `raw` 或倍數錯，調整 `_NUMBER_RE`，不要改測試。

- [ ] **Step 5: 跑整套後端測試**

Run: `./venv/bin/python -m pytest -q`
Expected: 全部通過（原本的 72 個加新增的 13 個）。

- [ ] **Step 6: Commit**

```bash
git add grounding_check.py tests/test_grounding_check.py
git -c user.name=wenn00 commit -m "feat: rule-based grounding check flags ungrounded numbers, fabricated citations and undisclosed assumptions"
```

---

### Task 2: pipeline 接上檢查並發 `grounding` 事件

**Files:**
- Modify: `main.py`（import 區、`run_pipeline` 內 `generate_product_proposal` 之後、`record` 字典）
- Test: `tests/test_pipeline_events.py`

**Interfaces:**
- Consumes: `check_grounding` from Task 1。
- Produces: SSE 事件 `grounding`（data 為 grounding 物件）；`proposal_data["grounding"]`；`record["grounding"]`。

- [ ] **Step 1: 改測試讓它失敗**

在 `tests/test_pipeline_events.py` 裡，把 `test_run_pipeline_emits_stages_in_order_and_persists` 的期望順序改成：

```python
    assert events == [
        "news_fetched", "news_selected", "kb_matched", "actuarial",
        "pm", "underwriter", "actuary", "grounding", "report", "chain_pending", "chain_done", "done",
    ]
```

並在檔案最後加：

```python
def test_run_pipeline_stores_the_grounding_result_and_hands_it_to_the_report(monkeypatch):
    saved, seen = [], {}
    _wire_fakes(monkeypatch, saved)

    def _capture_report(proposal_data):
        seen["proposal_data"] = proposal_data
        return "reports/x.docx"

    monkeypatch.setattr(main, "generate_report", _capture_report)

    record = main.run_pipeline()

    assert record["grounding"]["status"] == "pass"
    assert record["grounding"]["checker_version"] == "grounding-check/v1"
    assert seen["proposal_data"]["grounding"] is record["grounding"]
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `./venv/bin/python -m pytest -q tests/test_pipeline_events.py`
Expected: 2 failed（順序少了 `grounding`；`KeyError: 'grounding'`）。

- [ ] **Step 3: 改 `main.py`**

import 區加一行（放在 `from chain_writer import ...` 之後，維持字母順序）：

```python
from grounding_check import check_grounding
```

`run_pipeline` 裡把

```python
    proposal_data = generate_product_proposal(selected_news, gap_analysis, actuarial_data, on_stage=_emit)

    report_path = generate_report(proposal_data)
```

改成

```python
    proposal_data = generate_product_proposal(selected_news, gap_analysis, actuarial_data, on_stage=_emit)

    # 幻覺檢測：純規則、不呼叫 LLM。掛在 proposal_data 上讓 Word 報告與上鏈 payload 都拿得到，
    # 也單獨存進紀錄給歷史列表與前端。
    grounding = check_grounding(proposal_data, selected_news, gap_analysis["matched_products"])
    proposal_data["grounding"] = grounding
    _emit("grounding", grounding)

    report_path = generate_report(proposal_data)
```

`record` 字典在 `"proposal_data": proposal_data,` 後面加：

```python
        "grounding": grounding,
```

- [ ] **Step 4: 跑測試確認通過**

Run: `./venv/bin/python -m pytest -q tests/test_pipeline_events.py`
Expected: 全部通過（含既有的去重測試）。

- [ ] **Step 5: Commit**

```bash
git add main.py tests/test_pipeline_events.py
git -c user.name=wenn00 commit -m "feat: run the grounding check after the debate and emit it as a pipeline stage"
```

---

### Task 3: 把結論封進上鏈 payload

**Files:**
- Modify: `chain_writer.py`（`build_decision_payload`）
- Test: `tests/test_chain_writer.py`

**Interfaces:**
- Consumes: `proposal_data["grounding"]`（可能不存在）。
- Produces: payload 新欄位 `grounding_status`、`grounding_flag_count`、`grounding_checker_version`；`agent_pipeline_version` 為 `"v1.5.0"`。

- [ ] **Step 1: 寫失敗的測試**

在 `tests/test_chain_writer.py` 最後加：

```python
GROUNDING = {"status": "fail", "flag_count": 2, "checker_version": "grounding-check/v1", "flags": []}


def test_payload_seals_the_grounding_verdict(monkeypatch):
    _force_mock(monkeypatch)

    receipt = chain_writer.audit_proposal_on_chain(
        {"proposal": {"product_name": "X"}, "actuarial_data": {}, "grounding": GROUNDING}
    )

    payload = receipt["payload"]
    assert payload["grounding_status"] == "fail"
    assert payload["grounding_flag_count"] == 2
    assert payload["grounding_checker_version"] == "grounding-check/v1"
    assert payload["agent_pipeline_version"] == "v1.5.0"


def test_payload_without_grounding_keeps_null_fields(monkeypatch):
    _force_mock(monkeypatch)

    payload = chain_writer.audit_proposal_on_chain({"proposal": {"product_name": "X"}, "actuarial_data": {}})["payload"]

    assert payload["grounding_status"] is None
    assert payload["grounding_flag_count"] is None


def test_changing_the_grounding_verdict_changes_the_hash():
    sealed = chain_writer.build_decision_payload("d1", {"proposal": {}, "actuarial_data": {}, "grounding": GROUNDING})
    laundered = dict(sealed, grounding_status="pass", grounding_flag_count=0)

    assert chain_writer.compute_hash(sealed) != chain_writer.compute_hash(laundered)
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `./venv/bin/python -m pytest -q tests/test_chain_writer.py`
Expected: 前兩個 `KeyError: 'grounding_status'`，第三個因為兩個 payload 相同而失敗。

- [ ] **Step 3: 改 `build_decision_payload`**

```python
def build_decision_payload(decision_id: str, proposal_data: dict) -> dict:
    """要被雜湊上鏈的結構化決策內容。驗證時必須用完全相同的 payload 重算。"""
    proposal = proposal_data.get("proposal", {})
    actuarial = proposal_data.get("actuarial_data", {})
    # 幻覺檢測的結論一起被雜湊：事後不能宣稱「當時檢查是過的」。舊紀錄沒有檢查，三個欄位為 None。
    grounding = proposal_data.get("grounding") or {}
    return {
        "decision_id": decision_id,
        "agent_pipeline_version": "v1.5.0",
        "trigger_news_source": proposal_data.get("source_news", "unknown_source"),
        "product_name": proposal.get("product_name", "未知險種"),
        "market_gap": proposal.get("market_gap", ""),
        "coverage_details": proposal.get("coverage_details", ""),
        "exclusions": proposal.get("exclusions", ""),
        "probability_pct": actuarial.get("probability_pct"),
        "expected_loss_usd": actuarial.get("expected_loss_usd"),
        "premium_range_usd": actuarial.get("premium_range_usd"),
        "grounding_status": grounding.get("status"),
        "grounding_flag_count": grounding.get("flag_count"),
        "grounding_checker_version": grounding.get("checker_version"),
    }
```

- [ ] **Step 4: 跑測試確認通過**

Run: `./venv/bin/python -m pytest -q tests/test_chain_writer.py tests/test_runs_api.py`
Expected: 全部通過。`test_runs_api.py` 用的是存好的 payload，不會受影響；若它失敗代表 `verify_run` 被改成重組 payload，停下來回報。

- [ ] **Step 5: Commit**

```bash
git add chain_writer.py tests/test_chain_writer.py
git -c user.name=wenn00 commit -m "feat: seal the grounding verdict into the on-chain decision payload"
```

---

### Task 4: 歷史紀錄的攤平格式與摘要

**Files:**
- Modify: `run_store.py`（`flatten_report`、`summarize`）
- Test: `tests/test_run_store.py`

**Interfaces:**
- Produces: `flatten_report(record)["grounding"]`（物件或 `None`）；`summarize(record)["grounding_status"]`（字串或 `None`）。

- [ ] **Step 1: 寫失敗的測試**

在 `tests/test_run_store.py` 最後加：

```python
GROUNDING = {"status": "warn", "flag_count": 1, "checker_version": "grounding-check/v1",
             "flags": [{"type": "missing_disclosure", "severity": "medium", "field": "business_logic"}]}


def _record_with_grounding():
    return {
        "decision_id": "foresure-g1",
        "timestamp": "20260905_150000",
        "news": {"title": "n"},
        "proposal_data": {"proposal": {"product_name": "G"}, "is_mock": False},
        "blockchain_receipt": {"decision_id": "foresure-g1", "is_mock": False, "blockchain_tx_hash": "0xabc"},
        "grounding": GROUNDING,
    }


def test_summarize_exposes_the_grounding_status():
    assert run_store.summarize(_record_with_grounding())["grounding_status"] == "warn"


def test_flatten_report_carries_the_full_grounding_result():
    flat = run_store.flatten_report(_record_with_grounding())
    assert flat["grounding"] == GROUNDING


def test_summary_and_flat_formats_tolerate_records_without_grounding():
    legacy = {
        "timestamp": "20260905_021125",
        "proposal_data": {"proposal": {"product_name": "舊格式商品"}, "is_mock": False},
        "blockchain_receipt": {"decision_id": "atlas-legacy-1", "is_mock": True},
    }
    assert run_store.summarize(legacy)["grounding_status"] is None
    assert run_store.flatten_report(legacy)["grounding"] is None
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `./venv/bin/python -m pytest -q tests/test_run_store.py`
Expected: 3 failed，`KeyError: 'grounding_status'` 與 `KeyError: 'grounding'`。

- [ ] **Step 3: 改 `run_store.py`**

`flatten_report` 的回傳字典，在 `"actuarial_data": actuarial,` 後面加：

```python
        # 幻覺檢測結果；2026-09-05 之前的舊紀錄沒有這一欄，前端要能容忍 None。
        "grounding": record.get("grounding") or proposal_data.get("grounding"),
```

`summarize` 的回傳字典，在 `"is_mock_proposal": ...,` 後面加：

```python
        "grounding_status": (record.get("grounding") or {}).get("status"),
```

- [ ] **Step 4: 跑測試確認通過**

Run: `./venv/bin/python -m pytest -q tests/test_run_store.py tests/test_compat_reports.py tests/test_runs_api.py`
Expected: 全部通過。

- [ ] **Step 5: Commit**

```bash
git add run_store.py tests/test_run_store.py
git -c user.name=wenn00 commit -m "feat: expose the grounding result in run history and its summary"
```

---

### Task 5: Word 報告第 4 節「幻覺檢測」

**Files:**
- Modify: `report_generator.py`（新增 `_GROUNDING_LABEL`、`_FLAG_LABEL`、`_add_grounding_section`；`generate_report` 在商業邏輯之後呼叫）
- Test: `tests/test_report_generator.py`

**Interfaces:**
- Consumes: `proposal_data["grounding"]`（可能不存在）。

- [ ] **Step 1: 寫失敗的測試**

在 `tests/test_report_generator.py` 最後加：

```python
GROUNDING_FAIL = {
    "status": "fail", "checker_version": "grounding-check/v1",
    "checked_claims": 3, "grounded_claims": 2, "flag_count": 1,
    "evidence_sources": ["actuarial_engine", "news", "matched_products"],
    "flags": [{"type": "unsupported_number", "severity": "high", "field": "business_logic", "value": "35%",
               "excerpt": "透過再保險分散風險，保費利潤率預期可達 35%。",
               "message": "「35%」對不回精算引擎輸出、新聞原文或既有商品資料"}],
}


def test_report_spells_out_the_grounding_verdict_and_every_flag(tmp_path):
    data = {"proposal": PROPOSAL, "source_news": "n", "news_summary": "s",
            "actuarial_data": {"probability_pct": 51.61, "expected_loss_usd": 14447368.42,
                               "premium_range_usd": [15938709.68, 26564516.13]},
            "grounding": GROUNDING_FAIL}

    text = _text_of(generate_report(data, output_dir=str(tmp_path)))

    assert "幻覺檢測" in text and "Grounding Check" in text
    assert "未通過" in text
    assert "無來源的數字" in text and "business_logic" in text and "35%" in text
    assert "保費利潤率預期可達 35%" in text
    assert "grounding-check/v1" in text


def test_report_without_grounding_has_no_grounding_section(tmp_path):
    data = {"proposal": PROPOSAL, "source_news": "n", "news_summary": "s",
            "actuarial_data": {"probability_pct": 4.57, "expected_loss_usd": 41839.45,
                               "premium_range_usd": [3495.69, 5825.49]}}

    text = _text_of(generate_report(data, output_dir=str(tmp_path)))

    assert "幻覺檢測" not in text
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `./venv/bin/python -m pytest -q tests/test_report_generator.py`
Expected: 第一個失敗（`"幻覺檢測" in text` 為 False），第二個通過。

- [ ] **Step 3: 改 `report_generator.py`**

在 `_safe_name` 之前加：

```python
_GROUNDING_LABEL = {
    "pass": ("通過：風險與定價數字皆可追溯到來源", "Pass: every risk and pricing figure traces back to a source"),
    "warn": ("警示：需補充揭露，建議人工確認", "Warning: a disclosure is missing; human confirmation advised"),
    "fail": ("未通過：發現無來源的數字或無法驗證的引用，須人工審核後才可送審",
             "Fail: ungrounded figures or unverifiable citations found; human review required before filing"),
}
_FLAG_LABEL = {
    "unsupported_number": ("無來源的數字", "Ungrounded number"),
    "unverified_citation": ("無法驗證的引用", "Unverifiable citation"),
    "missing_disclosure": ("假設值未揭露", "Assumption not disclosed"),
}


def _add_grounding_section(doc, grounding: dict) -> None:
    """Rule-based hallucination check: the verdict, the counts and every flag, written for the human reviewer."""
    _heading(doc, "4. 幻覺檢測", "Grounding Check", level=1)
    zh, en = _GROUNDING_LABEL.get(grounding.get("status"), ("未知", "Unknown"))
    doc.add_paragraph(_label("結果", "Verdict", zh))
    _english(doc.add_paragraph(), en)
    checked, grounded = grounding.get("checked_claims", 0), grounding.get("grounded_claims", 0)
    doc.add_paragraph(_label("檢查的數字", "Figures checked",
                             f"{checked} 項，其中 {grounded} 項有來源 / {grounded} of {checked} grounded"))
    for flag in grounding.get("flags") or []:
        fz, fe = _FLAG_LABEL.get(flag.get("type"), (str(flag.get("type", "")), str(flag.get("type", ""))))
        line = f"[{flag.get('severity', '')}] {fz} / {fe}：{flag.get('field', '')}"
        if flag.get("value"):
            line += f" → {flag['value']}"
        doc.add_paragraph(line)
        if flag.get("excerpt"):
            doc.add_paragraph(f"「{flag['excerpt']}」")
        if flag.get("message"):
            doc.add_paragraph(flag["message"])
    doc.add_paragraph(_label("檢查器版本", "Checker version", grounding.get("checker_version", "")))
```

`generate_report` 裡，在

```python
    _heading(doc, '商業邏輯與獲利模式', 'Business Logic & Profit Model', level=2)
    _bilingual_section(doc, proposal.get('business_logic'), proposal.get('business_logic_en'))
```

之後、`# 儲存檔案 / Save` 之前加：

```python
    # 4. 幻覺檢測 / Grounding check（舊紀錄沒有，略過）
    grounding = proposal_data.get("grounding")
    if grounding:
        _add_grounding_section(doc, grounding)
```

- [ ] **Step 4: 跑測試確認通過**

Run: `./venv/bin/python -m pytest -q tests/test_report_generator.py`
Expected: 全部通過（含既有的雙語與 basis 測試）。

- [ ] **Step 5: Commit**

```bash
git add report_generator.py tests/test_report_generator.py
git -c user.name=wenn00 commit -m "feat: docx report gets a grounding-check section listing the verdict and every flag"
```

---

### Task 6: 更新 `docs/API.md` 契約與 README

**Files:**
- Modify: `docs/API.md`（SSE 表、完整紀錄與摘要格式、新節）
- Modify: `README.md`（核心亮點加一節）

- [ ] **Step 1: 改 SSE 表**

把表格的第 7 到 11 列（`actuary` 到 `done`）換成：

```markdown
| 7 | `actuary` | 字串，精算師的 business_logic | 中欄第三段 |
| 8 | `grounding` | 幻覺檢測結果，格式見下方「幻覺檢測」 | 右欄徽章（通過／警示／未通過） |
| 9 | `report` | `{report_path}` | 顯示已產出 docx |
| 10 | `chain_pending` | `{network}` | 徽章轉成「上鏈中…」 |
| 11 | `chain_done` | 鏈上收據，見下 | 徽章轉成「已上鏈」或「模擬」 |
| 12 | `done` | 完整紀錄（與 `GET /api/v1/runs/{decision_id}` 相同） | 收尾、加入歷史列表 |
```

- [ ] **Step 2: 改「歷史紀錄」節的兩個格式**

```markdown
- `GET /api/v1/runs?limit=50` → 摘要陣列，最新在前：
  `{decision_id, run_id, timestamp, news_title, product_name, is_mock_proposal, grounding_status, chain_is_mock, tx_hash, verification_url}`
- `GET /api/v1/runs/{decision_id}` → 完整紀錄：
  `{decision_id, timestamp, news, matched_products, actuarial_data, proposal_data:{proposal, debate:{pm, underwriter}, is_mock, model}, grounding, blockchain_receipt, report_path}`
```

並在「攤平格式端點」那段最後加一句：`攤平格式也有頂層 grounding。`

- [ ] **Step 3: 在檔案最後加新節**

```markdown
## 幻覺檢測（`grounding`）

每次執行在辯論結束後、產出報告與上鏈之前，由 `grounding_check.py` 對最終提案做一次純規則檢查
（不呼叫 LLM，離線可重跑，同樣輸入必得同樣輸出）。結果出現在四個地方：SSE 的 `grounding` 事件、
完整紀錄與攤平格式的頂層 `grounding`、摘要的 `grounding_status`，以及上鏈 payload 的
`grounding_status`、`grounding_flag_count`、`grounding_checker_version`（所以結論被雜湊封存，事後改不了）。

```json
{
  "status": "fail",
  "checker_version": "grounding-check/v1",
  "checked_claims": 3,
  "grounded_claims": 2,
  "flag_count": 1,
  "evidence_sources": ["actuarial_engine", "news", "matched_products"],
  "flags": [
    {"type": "unsupported_number", "severity": "high", "field": "business_logic", "value": "35%",
     "excerpt": "透過再保險分散風險，保費利潤率預期可達 35%。",
     "message": "「35%」對不回精算引擎輸出、新聞原文或既有商品資料"}
  ]
}
```

- `status`：`pass`（沒有標記）、`warn`（只有 medium）、`fail`（有 high）。
- `flags[].type`：`unsupported_number`（`market_gap`／`business_logic` 裡對不回精算引擎、新聞或既有商品的數字，容許 2% 誤差；`coverage_details`／`exclusions` 是商品設計參數不受檢）、`unverified_citation`（「根據 X 統計」的 X 不在本次證據裡）、`missing_disclosure`（數字含假設值但敘述沒寫「假設」或「估計」）。
- `flags[].severity`：`high` 或 `medium`；`field` 是提案欄位名；`value` 是被標記的數字或來源名（`missing_disclosure` 為 `null`）；`excerpt` 是原文片段。
- 建議畫面：右欄徽章「✓ 幻覺檢測通過」綠、「! 幻覺檢測警示 (n)」琥珀、「✕ 幻覺檢測未通過 (n)」紅；證據與稽核分頁列出每一項標記（類型、欄位、值、原文片段）；佇列與歷史列表在 warn／fail 時顯示徽章。
- 舊紀錄（2026-09-05 15:00 之前產生）沒有 `grounding`，`grounding_status` 為 `null`，前端要能容忍缺欄。
```

- [ ] **Step 4: README 加一節**

在 README「### 5.」那節之後加：

```markdown
### 6. 🔍 幻覺檢測 (Grounding Check)
辯論產出提案後、產報告與上鏈之前，`grounding_check.py` 對提案做一次**純規則、不呼叫 LLM** 的檢查：
- **無來源的數字**：市場缺口與商業邏輯裡的數字，必須對得回精算引擎輸出、新聞原文或既有商品資料（允許 2% 四捨五入誤差）。保障內容裡的商品設計參數（如「每日補償 5,000 美元」）是設計選擇，不受檢。
- **捏造的來源**：「根據 X 統計」的 X 必須真的存在於本次證據。
- **假設值未揭露**：精算數字含假設值時，提案必須寫明「假設」或「估計」。

結論（通過／警示／未通過）與標記數一起被雜湊上鏈，並寫進 Word 報告第 4 節，事後無法宣稱「當時檢查是過的」。這對應國泰 AI 落地標準中的「幻覺檢測」與「人審」。
```

- [ ] **Step 5: Commit**

```bash
git add docs/API.md README.md
git -c user.name=wenn00 commit -m "docs: grounding event, record fields and payload columns in the API contract and README"
```

- [ ] **Step 6: 重啟後端**

```bash
kill $(lsof -nP -t -iTCP:8080 -sTCP:LISTEN); sleep 1
nohup ./venv/bin/uvicorn apigee_target:app --port 8080 --log-level info > /tmp/uvicorn.log 2>&1 &
```

等 `curl -s http://127.0.0.1:8080/api/v1/health` 回 `{"status":"ok",...}`。

---

### Task 7: 前端型別、階段順序、字典與 reducer

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/stages.ts`
- Modify: `frontend/src/lib/i18n.tsx`（zh 與 en 兩邊）
- Modify: `frontend/src/lib/runReducer.ts`
- Test: `frontend/src/lib/__tests__/runReducer.test.ts`

**Interfaces:**
- Produces: `type GroundingStatus = "pass" | "warn" | "fail"`、`type GroundingFlag`、`type Grounding`；`Stage` 多一個 `"grounding"`；`RunRecord.grounding?: Grounding | null`；`RunSummary.grounding_status?: GroundingStatus | null`；`RunState.grounding: Grounding | null`；字典 key `stage.grounding`、`grounding.title`、`grounding.pass`、`grounding.warn`、`grounding.fail`、`grounding.checked`、`grounding.grounded`、`grounding.noFlags`、`grounding.field`、`grounding.version`、`grounding.legacy`、`grounding.flag.unsupported_number`、`grounding.flag.unverified_citation`、`grounding.flag.missing_disclosure`。

- [ ] **Step 1: 寫失敗的測試**

在 `frontend/src/lib/__tests__/runReducer.test.ts` 的 `describe` 內加：

```ts
  it("stores the grounding verdict and advances past the actuary stage", () => {
    let s = startRunState("r1", 0);
    s = applyEvent(s, { stage: "actuary", data: "精算說" }, 1000);
    const grounding = { status: "warn", checker_version: "grounding-check/v1", checked_claims: 2, grounded_claims: 2,
      flag_count: 1, evidence_sources: ["actuarial_engine"], flags: [
        { type: "missing_disclosure", severity: "medium", field: "business_logic", value: null, excerpt: "", message: "m" },
      ] } as const;
    s = applyEvent(s, { stage: "grounding", data: grounding }, 1500);
    expect(s.grounding?.status).toBe("warn");
    expect(s.grounding?.flags[0].type).toBe("missing_disclosure");
    expect(s.stageIndex).toBe(7); // news_fetched(0) … actuary(6), grounding(7)
    expect(s.timings.grounding).toBe(1.5);
  });
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd frontend && npm test`
Expected: 該測試失敗（`s.grounding` 為 undefined；或 TypeScript 型別錯誤 `"grounding"` 不是 `Stage`）。

- [ ] **Step 3: 改 `types.ts`**

在 `Debate` 型別之前加：

```ts
export type GroundingStatus = "pass" | "warn" | "fail";

export type GroundingFlag = {
  type: "unsupported_number" | "unverified_citation" | "missing_disclosure";
  severity: "high" | "medium";
  field: string;
  value: string | null;
  excerpt: string;
  message: string;
};

/** Rule-based hallucination check run after the debate (docs/API.md "幻覺檢測"); absent on records before 2026-09-05 15:00. */
export type Grounding = {
  status: GroundingStatus;
  checker_version: string;
  checked_claims: number;
  grounded_claims: number;
  flag_count: number;
  evidence_sources: string[];
  flags: GroundingFlag[];
};
```

`RunRecord` 在 `proposal_data: ProposalData;` 後面加 `grounding?: Grounding | null;`。
`RunSummary` 在 `is_mock_proposal: boolean | null;` 後面加 `grounding_status?: GroundingStatus | null;`。
`Stage` 聯集在 `| "actuary"` 之後加 `| "grounding"`。

- [ ] **Step 4: 改 `stages.ts`**

`STAGES` 陣列在 `"actuary",` 之後插入 `"grounding",`（總共 12 個）。

- [ ] **Step 5: 改 `i18n.tsx`**

zh 區塊在 `"stage.actuary": "精算定案",` 之後加 `"stage.grounding": "幻覺檢測",`，並在 `"num.source": ...,` 之後加：

```ts
    "grounding.title": "幻覺檢測",
    "grounding.pass": "幻覺檢測通過",
    "grounding.warn": "幻覺檢測警示",
    "grounding.fail": "幻覺檢測未通過",
    "grounding.checked": "檢查的數字",
    "grounding.grounded": "項有來源",
    "grounding.noFlags": "沒有任何標記",
    "grounding.field": "欄位",
    "grounding.version": "檢查器版本",
    "grounding.legacy": "此紀錄產生時尚無幻覺檢測",
    "grounding.flag.unsupported_number": "無來源的數字",
    "grounding.flag.unverified_citation": "無法驗證的引用",
    "grounding.flag.missing_disclosure": "假設值未揭露",
```

en 區塊對應位置加 `"stage.grounding": "Grounding",` 與：

```ts
    "grounding.title": "Grounding check",
    "grounding.pass": "Grounding check passed",
    "grounding.warn": "Grounding warning",
    "grounding.fail": "Grounding check failed",
    "grounding.checked": "Figures checked",
    "grounding.grounded": "grounded",
    "grounding.noFlags": "No flags",
    "grounding.field": "Field",
    "grounding.version": "Checker version",
    "grounding.legacy": "This record predates the grounding check",
    "grounding.flag.unsupported_number": "Ungrounded number",
    "grounding.flag.unverified_citation": "Unverifiable citation",
    "grounding.flag.missing_disclosure": "Assumption not disclosed",
```

- [ ] **Step 6: 改 `runReducer.ts`**

import 加 `Grounding`：

```ts
import type { ActuarialData, Grounding, MatchedProduct, NewsItem, Receipt, RunEvent, RunRecord, Stage } from "@/lib/types";
```

`RunState` 在 `debate` 之後加 `grounding: Grounding | null;`；`initialRunState` 加 `grounding: null,`；`switch` 在 `case "actuary"` 之後加：

```ts
    case "grounding":
      next.grounding = data as Grounding;
      break;
```

- [ ] **Step 7: 跑測試、lint、build**

Run: `cd frontend && npm test && npm run lint && npm run build`
Expected: vitest 全過（含 i18n 對稱測試）、eslint 乾淨、靜態匯出成功。`StageProgress` 讀 `STAGES.length`，進度條會自動變成 12 段。

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/stages.ts frontend/src/lib/i18n.tsx frontend/src/lib/runReducer.ts frontend/src/lib/__tests__/runReducer.test.ts
git -c user.name=wenn00 commit -m "feat(frontend): grounding stage, types, dictionary and reducer state"
```

---

### Task 8: `GroundingBadge` 與四個顯示位置

**Files:**
- Create: `frontend/src/lib/grounding.ts`
- Test: `frontend/src/lib/__tests__/grounding.test.ts`
- Create: `frontend/src/components/GroundingBadge.tsx`
- Modify: `frontend/src/app/page.tsx`（右欄標題列）
- Modify: `frontend/src/components/DecisionDetail.tsx`（標題列、audit 分頁）
- Modify: `frontend/src/components/RunQueue.tsx`、`frontend/src/components/HistorySection.tsx`

**Interfaces:**
- Consumes: Task 7 的型別與字典 key。
- Produces: `groundingTone(status)`、`flagTypeKey(type)`；`<GroundingBadge grounding={...} />` 或 `<GroundingBadge status={...} />`；`<GroundingFlags grounding={...} />`。

- [ ] **Step 1: 寫失敗的測試**

建立 `frontend/src/lib/__tests__/grounding.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { flagTypeKey, groundingTone } from "@/lib/grounding";

describe("grounding helpers", () => {
  it("maps a verdict to a tone and treats missing data as none", () => {
    expect(groundingTone("pass")).toBe("pass");
    expect(groundingTone("warn")).toBe("warn");
    expect(groundingTone("fail")).toBe("fail");
    expect(groundingTone(null)).toBe("none");
    expect(groundingTone(undefined)).toBe("none");
  });
  it("maps a flag type to its dictionary key", () => {
    expect(flagTypeKey("unsupported_number")).toBe("grounding.flag.unsupported_number");
    expect(flagTypeKey("missing_disclosure")).toBe("grounding.flag.missing_disclosure");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd frontend && npm test`
Expected: 找不到模組 `@/lib/grounding`。

- [ ] **Step 3: 寫 `frontend/src/lib/grounding.ts`**

```ts
import type { DictKey } from "@/lib/i18n";
import type { GroundingFlag, GroundingStatus } from "@/lib/types";

export type GroundingTone = "none" | GroundingStatus;

/** Verdict → badge tone. Anything missing or unknown (legacy records) renders nothing. */
export function groundingTone(status: GroundingStatus | string | null | undefined): GroundingTone {
  return status === "pass" || status === "warn" || status === "fail" ? status : "none";
}

export function flagTypeKey(type: GroundingFlag["type"]): DictKey {
  return `grounding.flag.${type}` as DictKey;
}
```

- [ ] **Step 4: 寫 `frontend/src/components/GroundingBadge.tsx`**

```tsx
"use client";

import { flagTypeKey, groundingTone } from "@/lib/grounding";
import { useT } from "@/lib/i18n";
import type { Grounding, GroundingStatus } from "@/lib/types";

const TONE_CLASS = {
  pass: "pill bg-primary-soft text-primary-ink",
  warn: "pill bg-warn-soft text-warn",
  fail: "pill bg-danger-soft text-danger",
} as const;
const TONE_MARK = { pass: "✓", warn: "!", fail: "✕" } as const;

/** Verdict pill. Pass `grounding` for the full object (shows the flag count) or just `status` from a summary row. */
export default function GroundingBadge({
  grounding,
  status,
}: {
  grounding?: Grounding | null;
  status?: GroundingStatus | null;
}) {
  const t = useT();
  const tone = groundingTone(grounding?.status ?? status);
  if (tone === "none") return null;
  const count = grounding && tone !== "pass" ? ` (${grounding.flag_count})` : "";
  return (
    <span className={TONE_CLASS[tone]} title={t("grounding.title")}>
      {TONE_MARK[tone]} {t(`grounding.${tone}`)}
      {count}
    </span>
  );
}

/** Counts plus one row per flag, for the audit tab. */
export function GroundingFlags({ grounding }: { grounding: Grounding }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="text-muted">
        {t("grounding.checked")}: <span className="mono">{grounding.checked_claims}</span> ·{" "}
        <span className="mono">{grounding.grounded_claims}</span> {t("grounding.grounded")}
      </div>
      {grounding.flags.length === 0 ? (
        <div className="text-muted">{t("grounding.noFlags")}</div>
      ) : (
        grounding.flags.map((flag, i) => (
          <div key={`${flag.type}-${flag.field}-${i}`} className="rounded-lg border border-border bg-surface-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={flag.severity === "high" ? TONE_CLASS.fail : TONE_CLASS.warn}>{t(flagTypeKey(flag.type))}</span>
              <span className="text-xs text-muted">
                {t("grounding.field")}: <span className="mono">{flag.field}</span>
              </span>
              {flag.value ? <span className="mono text-xs">{flag.value}</span> : null}
            </div>
            {flag.excerpt ? <p className="mt-1 text-xs text-muted">「{flag.excerpt}」</p> : null}
            <p className="mt-1 text-xs">{flag.message}</p>
          </div>
        ))
      )}
      <div className="text-xs text-muted">
        {t("grounding.version")}: <span className="mono">{grounding.checker_version}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 放進即時執行頁 `frontend/src/app/page.tsx`**

import 加 `import GroundingBadge from "@/components/GroundingBadge";`。右欄標題列把

```tsx
              <div className="label">{t("col.proposal")}</div>
              <ChainBadge
                state={badge}
                url={state.receipt?.verification_url}
                txHash={state.receipt?.blockchain_tx_hash}
              />
```

改成

```tsx
              <div className="label">{t("col.proposal")}</div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <GroundingBadge grounding={state.grounding ?? state.record?.grounding} />
                <ChainBadge
                  state={badge}
                  url={state.receipt?.verification_url}
                  txHash={state.receipt?.blockchain_tx_hash}
                />
              </div>
```

- [ ] **Step 6: 放進 `DecisionDetail.tsx`**

import 加 `import GroundingBadge, { GroundingFlags } from "@/components/GroundingBadge";`。標題列把 `<ChainBadge state={badge} url={receipt.verification_url} txHash={receipt.blockchain_tx_hash} />` 包成：

```tsx
        <div className="flex flex-wrap items-center justify-end gap-2">
          <GroundingBadge grounding={record.grounding} />
          <ChainBadge state={badge} url={receipt.verification_url} txHash={receipt.blockchain_tx_hash} />
        </div>
```

audit 分頁在 `</div>`（收據 `Row` 那組）之後、`{children}` 之前加：

```tsx
            <div>
              <div className="label mb-2">{t("grounding.title")}</div>
              {record.grounding ? (
                <div className="flex flex-col gap-2">
                  <div>
                    <GroundingBadge grounding={record.grounding} />
                  </div>
                  <GroundingFlags grounding={record.grounding} />
                </div>
              ) : (
                <p className="text-xs text-muted">{t("grounding.legacy")}</p>
              )}
            </div>
```

- [ ] **Step 7: 放進 `RunQueue.tsx` 與 `HistorySection.tsx`**

兩個檔案都 import `GroundingBadge`。`RunQueue.tsx` 的上鏈 pill 那個 `<span ...>{onchain ? ... : ...}</span>` 改成用一個直排容器包住，並只在非 pass 時顯示：

```tsx
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`pill ${onchain ? "bg-primary-soft text-primary-ink" : "border border-border bg-surface-2 text-muted"}`}
                    >
                      {onchain ? t("queue.onchain") : t("queue.mock")}
                    </span>
                    {r.grounding_status === "warn" || r.grounding_status === "fail" ? (
                      <GroundingBadge status={r.grounding_status} />
                    ) : null}
                  </div>
```

`HistorySection.tsx` 在右側動作區（`<div className="flex flex-wrap items-center gap-3 pt-2 md:pt-0">` 內、上鏈 pill 之前）加 `<GroundingBadge status={r.grounding_status} />`（所有狀態都顯示，舊紀錄自動不顯示）。

- [ ] **Step 8: 跑測試、lint、build**

Run: `cd frontend && npm test && npm run lint && npm run build`
Expected: 全過。若 `bg-danger-soft` 或 `text-danger` 這兩個 class 在 `globals.css` 沒定義，先 `grep -n "danger" frontend/src/app/globals.css` 確認；`ChainBadge` 已經在用 `bg-danger-soft text-danger`，正常應該存在。

- [ ] **Step 9: Commit**

```bash
git add frontend/src/lib/grounding.ts frontend/src/lib/__tests__/grounding.test.ts frontend/src/components/GroundingBadge.tsx frontend/src/app/page.tsx frontend/src/components/DecisionDetail.tsx frontend/src/components/RunQueue.tsx frontend/src/components/HistorySection.tsx
git -c user.name=wenn00 commit -m "feat(frontend): grounding badge on the live run, decision header, audit tab, queue and history"
```

---

### Task 9（選做）: 離線 demo 的假事件與假紀錄

**Files:**
- Modify: `frontend/src/lib/mockEvents.ts`
- Modify: `frontend/src/lib/mockData.ts`
- Modify: `frontend/src/app/page.tsx`（`STAGE_DELAYS`）

只影響後端不在時的離線模式。若時間不夠可以跳過，前端在沒有 `grounding` 時本來就不會顯示徽章。

- [ ] **Step 1: `mockEvents.ts`**

在 `stage: "actuary"` 那個事件物件之後、`stage: "report"` 之前插入：

```ts
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
```

- [ ] **Step 2: `page.tsx` 的 `STAGE_DELAYS`**

在 `11200, // actuary ...` 那行之後插入 `1500,  // grounding: rule-based check (1.5s)`，讓延遲陣列的索引與 `MOCK_EVENTS` 對齊。

- [ ] **Step 3: `mockData.ts`**

`MOCK_RUN_RECORDS` 每一筆物件在 `report_path` 那行之後加一個 `grounding` 屬性，內容同 Step 1 的 `data`（想示範警示就把其中一筆改成 `status: "warn"`、`flag_count: 1`、`flags: [{ type: "missing_disclosure", severity: "medium", field: "business_logic", value: null, excerpt: "", message: "精算數字含假設值，但提案未揭露「假設」或「估計」" }]`）。`MOCK_RUN_SUMMARIES` 對應加 `grounding_status`。

- [ ] **Step 4: 跑測試、lint、build 後 commit**

```bash
cd frontend && npm test && npm run lint && npm run build
git add frontend/src/lib/mockEvents.ts frontend/src/lib/mockData.ts frontend/src/app/page.tsx
git -c user.name=wenn00 commit -m "feat(frontend): grounding stage in the offline demo playback and mock records"
```

---

### Task 10: 整合驗證

- [ ] **Step 1: 後端全套測試**

Run: `./venv/bin/python -m pytest -q`
Expected: 全部通過。

- [ ] **Step 2: 前端全套**

Run: `cd frontend && npm test && npm run lint && npm run build`
Expected: 全部通過。

- [ ] **Step 3: 重啟後端並跑一輪真的**

```bash
kill $(lsof -nP -t -iTCP:8080 -sTCP:LISTEN); sleep 1
nohup ./venv/bin/uvicorn apigee_target:app --port 8080 --log-level info > /tmp/uvicorn.log 2>&1 &
sleep 20; curl -s http://127.0.0.1:8080/api/v1/health
RUN=$(curl -s -X POST -H "Authorization: Bearer MOCK_APIGEE_TOKEN" http://127.0.0.1:8080/api/v1/runs | ./venv/bin/python -c "import sys,json;print(json.load(sys.stdin)['run_id'])")
curl -s -N --max-time 180 "http://127.0.0.1:8080/api/v1/runs/$RUN/events" | grep -A1 "^event: grounding"
```

Expected: 看到 `event: grounding` 與其 JSON（`status` 為 pass、warn 或 fail 都算成功）。接著：

```bash
curl -s "http://127.0.0.1:8080/api/v1/runs?limit=1" | ./venv/bin/python -c "import sys,json;print(json.load(sys.stdin)[0]['grounding_status'])"
```

Expected: 印出 `pass`、`warn` 或 `fail`。

- [ ] **Step 4: 在瀏覽器確認**

`cd frontend && npm run dev`，開 `http://localhost:3000`，按「執行新一輪分析」：進度條 12 段、第 8 段標「幻覺檢測」；右欄出現幻覺檢測徽章；跑完後點「查看完整提案」，「證據與稽核」分頁列出檢查數字與標記；切到英文再看一次。再開一筆舊紀錄（今天 15:00 前的），稽核分頁顯示「此紀錄產生時尚無幻覺檢測」、沒有徽章。

- [ ] **Step 5: 通知**

後端與前端各自完成後，互相通知對方已 commit 的 hash 與後端是否已重啟（同一台機器的另一個 Claude session 可用 SendMessage）。
