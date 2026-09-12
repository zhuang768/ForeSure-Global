"""幻覺檢測／數字接地檢查（grounding check）。

在多代理人辯論產出提案之後、產報告與上鏈之前，對提案做一次純規則、不呼叫 LLM、
離線可重現的檢查（同樣輸入必得同樣輸出）：

1. unsupported_number（high）：market_gap 與 business_logic 裡的數字，必須對得回精算引擎輸出
   （含 basis 說明文字裡的數字，例如嚴重事件門檻）、新聞原文或既有商品資料。
   coverage_details 與 exclusions 是商品設計參數，不受檢。
2. unverified_citation（high）：「根據 X 統計」的 X 必須出現在本次證據文字裡（比對時不算數字，
   年份與統計年段幾乎每個來源名都有，不能當成對上的依據）。
3. missing_disclosure（medium）：精算數字含假設值時，敘述必須揭露「假設」或「估計」。

結論 status：有 high 為 fail、只有 medium 為 warn、無標記為 pass。
"""
from __future__ import annotations

import re

CHECKER_VERSION = "grounding-check/v1.2"  # v1.2: digits never satisfy a citation; only % claims convert to fractions
NUMBER_TOLERANCE = 0.02  # 讓 LLM 四捨五入（0.6129 → 0.61、14,447,368 → 1,444 萬）仍算接地

CLAIM_FIELDS = ("market_gap", "business_logic")
CITATION_FIELDS = ("market_gap", "target_audience", "coverage_details", "exclusions", "business_logic")
DISCLOSURE_KEYWORDS = ("假設", "估計", "初估", "假定", "推估", "estimate", "assum")
_SELF_REFERENCES = ("精算引擎", "本模型", "本提案", "上述", "以上", "內部", "本公司", "我們")
_UNIT_SKIP = ("日", "天", "小時", "分鐘", "月", "週", "年", "次", "人", "家", "個", "項", "級", "期", "季", "倍",
              "毫米", "公分", "公尺", "mm", "cm")
_SCALE = {"萬": 1e4, "億": 1e8, "千": 1e3, "k": 1e3, "K": 1e3, "M": 1e6, "B": 1e9}
_CURRENCY_PREFIXES = ("USD", "NT$", "NTD", "TWD", "新台幣")  # 前置幣別＝保額／自負額等商品設計參數
_PAIR_SEPARATORS = "/-–"
_CITATION_WINDOW = 4  # 引用實體與證據文字的最小共同片段長度
_CITATION_NOISE_RE = re.compile(r"[\s\d,.\-–/]+")  # 比對來源名時剔除的空白、數字與年段分隔符

# 行首清單編號。(?!\d) 讓「3.5%」開頭的行不被當成編號「3.」而吃掉整數位。
_LIST_MARKER_RE = re.compile(r"(?m)^\s*\d+[.、)．](?!\d)\s*")
_UNIT_ALT = "|".join(re.escape(u) for u in sorted(_UNIT_SKIP, key=len, reverse=True))
_NUMBER_RE = re.compile(
    r"(?<![A-Za-z0-9_.])"            # 不接在 ASCII 字母、數字或小數點後面（\w 會誤吃中文字）
    r"(\d{1,3}(?:,\d{3})+|\d+)"      # 整數部分，可含千分位
    r"(?:\.(\d+))?"                  # 小數部分
    r"\s*(萬|億|千|[kKMB])?"         # 中文或 SI 倍數
    r"\s*(%|％)?"                    # 百分比
    rf"\s*({_UNIT_ALT})?"            # 後面緊接的計數單位（僅限 _UNIT_SKIP 中的詞，不吃標點或其他字）
)
_CITATION_PREFIX_RE = re.compile(r"^(?:根據|依據|參考)")
_CITATION_RES = (
    re.compile(r"(?:根據|依據|參考)\s*([^，。；,;：:\n]{2,40}?)(?:的)?(?:統計|資料|數據|報告|研究|調查)"),
    re.compile(r"([^，。；,;：:\n\s]{2,30}?)(?:統計顯示|數據顯示|報告指出|研究指出|資料顯示)"),
)


def _follows_ascii_word(text: str, start: int) -> bool:
    """數字前（最多隔一個空格）緊接 ASCII 單字：「ISO 27001」「Tier 2」是代號，不是宣稱。"""
    head = text[:start]
    if head.endswith(" "):
        head = head[:-1]
    return bool(head) and head[-1].isascii() and head[-1].isalpha()


def _follows_currency(text: str, start: int) -> bool:
    """數字前（最多隔一個空格）緊接幣別符號：「USD 5,000」是保額／自負額等商品設計參數。"""
    head = text[:start]
    if head.endswith(" "):
        head = head[:-1]
    return any(head.endswith(token) for token in _CURRENCY_PREFIXES)


def _starts_a_pair(text: str, end: int) -> bool:
    """「80/20」的 80、「3%-8%」的 3%：後面接分隔符加數字，是比例或區間而不是代號。"""
    return end + 1 < len(text) and text[end] in _PAIR_SEPARATORS and text[end + 1].isdigit()


def _ends_a_pair(text: str, start: int) -> bool:
    """「80/20」的 20、「3%-8%」的 8%：成對數字只算第一個，避免同一個設定被數兩次。"""
    return start >= 2 and text[start - 1] in _PAIR_SEPARATORS and (text[start - 2].isdigit() or text[start - 2] in "%％")


def extract_numbers(text: str) -> list[tuple[float, str]]:
    """回傳 (數值, 原文片段)。跳過清單編號、年份、小於 10 的計數、接著時間計數或度量單位的數字、
    ASCII 代號（ISO 27001）、成對數字的後半（80/20）、以及幣別前綴的商品設計參數（NT$ 3,500）。"""
    results: list[tuple[float, str]] = []
    cleaned = _LIST_MARKER_RE.sub("", text or "")
    for m in _NUMBER_RE.finditer(cleaned):
        integer, decimal, scale, pct, following = m.groups()
        value = float(f"{integer.replace(',', '')}.{decimal}" if decimal else integer.replace(",", ""))
        if scale:
            value *= _SCALE[scale]
        is_plain_int = not decimal and not scale and not pct
        end = m.end(4) if pct else m.end(3) if scale else m.end(2) if decimal else m.end(1)
        if is_plain_int and len(integer) == 4 and 1900 <= value <= 2100:
            continue  # 年份
        if is_plain_int and value < 10:
            continue  # 「3 日」這類描述用語
        if is_plain_int and following in _UNIT_SKIP:
            continue  # 「24 小時」「60 天」「100 毫米」
        if _ends_a_pair(cleaned, m.start()):
            continue  # 「80/20」的 20、「3%-8%」的 8%
        if is_plain_int and _follows_ascii_word(cleaned, m.start()) and not _starts_a_pair(cleaned, end):
            continue  # 「ISO 27001」「Tier 2」
        if _follows_currency(cleaned, m.start()):
            continue  # 「USD 5,000」「NT$ 3,500」
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


_BASIS_TEXT_KEYS = ("probability_source", "probability_source_en", "probability_method", "loss_method", "assumed_loss_note")


def _basis_texts(actuarial: dict) -> list[str]:
    """The basis strings are quoted to the agents in the actuarial brief (e.g. ">= 50 households"), so a
    proposal that repeats a figure from them is grounded in the engine's own output."""
    basis = actuarial.get("basis") or {}
    return [str(basis.get(k) or "") for k in _BASIS_TEXT_KEYS]


def _corpus_numbers(actuarial: dict, news: dict | None, products: list[dict] | None) -> list[float]:
    numbers = _walk_numbers(actuarial)
    for text in _basis_texts(actuarial) + _evidence_texts(news, products):
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
    parts = _basis_texts(actuarial) + _evidence_texts(news, products)
    return re.sub(r"\s+", "", " ".join(parts))


def _is_grounded(value: float, corpus: list[float], *, percent: bool = False) -> bool:
    """只有寫成百分比的宣稱才試百分比與小數互換（61% 對 0.6129）；一般金額不做，
    否則「27 億」÷100 剛好落進保費區間就會被當成有依據。"""
    candidates = (value, value / 100, value * 100) if percent else (value,)
    for c in corpus:
        for candidate in candidates:
            if abs(candidate - c) <= NUMBER_TOLERANCE * max(abs(c), 1e-9):
                return True
    return False


def _cited_entities(text: str) -> list[str]:
    entities = []
    for pattern in _CITATION_RES:
        for m in pattern.finditer(text or ""):
            entity = _CITATION_PREFIX_RE.sub("", m.group(1)).strip()
            if entity and not any(ref in entity for ref in _SELF_REFERENCES):
                entities.append(entity)
    return entities


def _citation_is_supported(entity: str, corpus_text: str) -> bool:
    """整串出現在證據裡就算數；否則只要有任一段連續 4 字重疊也算，讓 LLM 改寫過的來源名
    （「內政部消防署歷史淹水統計」對「內政部消防署 臺灣地區天然災害損失統計表」）不被誤判。"""
    stripped = re.sub(r"\s+", "", entity)
    if stripped in corpus_text:
        return True
    # 數字不算證據：「世界銀行 2025 年報告」不能因為 2025 對到消防署表名裡的 1958-2025 就算有來源。
    letters = _CITATION_NOISE_RE.sub("", entity)
    if len(letters) < _CITATION_WINDOW:
        return bool(letters) and letters in corpus_text  # 「消防署 1958-2025」剩下的短名要整串出現
    return any(
        letters[i: i + _CITATION_WINDOW] in corpus_text
        for i in range(len(letters) - _CITATION_WINDOW + 1)
    )


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
            if _is_grounded(value, corpus_numbers, percent=raw.endswith(("%", "％"))):
                grounded += 1
                continue
            flags.append({
                "type": "unsupported_number", "severity": "high", "field": field, "value": raw,
                "excerpt": _excerpt(text, raw),
                "message": f"「{raw}」對不回精算引擎輸出、新聞原文或既有商品資料",
            })

    seen_citations: set[tuple[str, str, str]] = set()
    for field in CITATION_FIELDS:
        text = proposal.get(field) or ""
        for entity in _cited_entities(text):
            if _citation_is_supported(entity, corpus_text):
                continue
            if ("unverified_citation", field, entity) in seen_citations:
                continue  # 同一段文字重複引用同一個來源只標一次
            seen_citations.add(("unverified_citation", field, entity))
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
