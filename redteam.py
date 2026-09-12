"""紅隊測試台（red team bench）：用固定的對抗語料衡量幻覺檢測到底攔不攔得住。

`grounding_check.py` 宣稱能抓出無來源的數字、捏造的引用與未揭露的假設值，但「宣稱有檢查」
和「檢查真的有效」是兩回事。本模組把 `data/redteam_cases.json` 裡的攻擊案例與對照組
餵給檢查器，算出檢出率與誤報率。

三個刻意的設計：

1. **不呼叫 LLM、不連網、不需要任何金鑰**，同樣的語料必得同樣的報告，評審可以當場重跑。
2. **對照組和攻擊組一樣重要**。只報「抓到幾件」很容易靠亂標一通拿滿分，所以對照組是正常
   提案，被標記就算誤報，兩個數字要一起看。
3. **已知漏洞照實列出**。`known_gap` 的案例是我們知道現行檢查器抓不到的攻擊（例如沒有數字的
   誇大宣稱），照實顯示為「漏抓」，不灌檢出率，也不讓 CI 失敗。紅隊報告的價值在於誠實。
4. **報告有雜湊**。`report_hash` 只跟語料與檢查器輸出有關，改了語料或改壞了檢查器，雜湊就會變。

CLI：`python redteam.py`（有漏抓或誤報時回傳碼為 1，可直接當 CI 關卡）。
"""
from __future__ import annotations

import hashlib
import json
import os
import sys

import grounding_check as gc

SUITE_VERSION = "redteam/v1"
CASES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "redteam_cases.json")

# 攻擊案例：攔下、漏抓；對照組：乾淨、誤報；已知漏洞：known_gap（照實記錄，不算進檢出率）。
OUTCOME_DETECTED = "detected"
OUTCOME_MISSED = "missed"
OUTCOME_CLEAN = "clean"
OUTCOME_FALSE_POSITIVE = "false_positive"
OUTCOME_KNOWN_GAP = "known_gap"


def load_suite(path: str | None = None) -> dict:
    with open(path or CASES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _merge(base: dict, override: dict | None) -> dict:
    """單層覆寫就夠了：案例只改提案欄位或新聞欄位，不改巢狀結構。"""
    merged = dict(base)
    merged.update(override or {})
    return merged


def build_inputs(suite: dict, case: dict) -> tuple[dict, dict, list[dict]]:
    """把 base 與案例的 overrides 併成 check_grounding 需要的三個參數。"""
    base = suite["base"]
    overrides = case.get("overrides") or {}
    proposal_data = {
        "proposal": _merge(base["proposal"], overrides.get("proposal")),
        "actuarial_data": _merge(base["actuarial_data"], overrides.get("actuarial_data")),
    }
    news = _merge(base["news"], overrides.get("news"))
    products = overrides.get("matched_products") or base["matched_products"]
    return proposal_data, news, products


def evaluate_case(suite: dict, case: dict) -> dict:
    proposal_data, news, products = build_inputs(suite, case)
    result = gc.check_grounding(proposal_data, news, products)

    expected = case.get("expect") or {}
    expected_status = expected.get("status")
    expected_types = list(expected.get("flag_types") or [])
    actual_types = [f["type"] for f in result["flags"]]

    # 攔下的條件：結論等於預期，而且預期的每一種標記都真的出現了。
    caught = result["status"] == expected_status and all(t in actual_types for t in expected_types)
    is_attack = case.get("attack", "none") != "none"
    known_gap = bool(case.get("known_gap"))
    if known_gap:
        # 已知抓不到的攻擊。真的被攔下了是好消息，照實升級成 detected。
        outcome = OUTCOME_DETECTED if result["status"] != "pass" else OUTCOME_KNOWN_GAP
    elif is_attack:
        outcome = OUTCOME_DETECTED if caught else OUTCOME_MISSED
    else:
        outcome = OUTCOME_CLEAN if result["status"] == "pass" else OUTCOME_FALSE_POSITIVE

    return {
        "id": case["id"],
        "title": case["title"],
        "attack": case.get("attack", "none"),
        "known_gap": known_gap,
        "description": case.get("description", ""),
        "expected_status": expected_status,
        "actual_status": result["status"],
        "expected_flag_types": expected_types,
        "actual_flag_types": actual_types,
        "outcome": outcome,
        "flags": result["flags"],
    }


def _report_hash(payload: dict) -> str:
    """只雜湊會影響結論的內容，因此同一份語料在任何機器上都得到同一個雜湊。"""
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def run_redteam(suite: dict | None = None) -> dict:
    """跑完整份語料，回傳可直接送給前端與 API 的報告。純函式、可離線重現。"""
    suite = suite or load_suite()
    cases = [evaluate_case(suite, c) for c in suite["cases"]]

    attack = [c for c in cases if c["attack"] != "none" and not c["known_gap"]]
    control = [c for c in cases if c["attack"] == "none" and not c["known_gap"]]
    gaps = [c for c in cases if c["known_gap"]]
    detected = sum(1 for c in attack if c["outcome"] == OUTCOME_DETECTED)
    missed = len(attack) - detected
    false_positives = sum(1 for c in control if c["outcome"] == OUTCOME_FALSE_POSITIVE)

    body = {
        "suite_version": suite.get("suite_version", SUITE_VERSION),
        "checker_version": gc.CHECKER_VERSION,
        "total_cases": len(cases),
        "attack_cases": len(attack),
        "control_cases": len(control),
        "known_gap_cases": len(gaps),
        "known_gaps_open": sum(1 for c in gaps if c["outcome"] == OUTCOME_KNOWN_GAP),
        "detected": detected,
        "missed": missed,
        "false_positives": false_positives,
        "detection_rate": round(detected / len(attack), 4) if attack else None,
        "false_positive_rate": round(false_positives / len(control), 4) if control else None,
        "cases": cases,
    }
    return {**body, "report_hash": _report_hash(body)}


def format_report(report: dict) -> str:
    mark = {OUTCOME_DETECTED: "攔下", OUTCOME_MISSED: "漏抓", OUTCOME_CLEAN: "乾淨",
            OUTCOME_FALSE_POSITIVE: "誤報", OUTCOME_KNOWN_GAP: "已知漏洞"}
    lines = [
        f"紅隊測試台 {report['suite_version']} × 檢查器 {report['checker_version']}",
        f"攻擊 {report['attack_cases']} 案：攔下 {report['detected']}、漏抓 {report['missed']}"
        f"（檢出率 {report['detection_rate']}）",
        f"對照 {report['control_cases']} 案：誤報 {report['false_positives']}"
        f"（誤報率 {report['false_positive_rate']}）",
        f"已知漏洞 {report['known_gap_cases']} 案：仍未修補 {report['known_gaps_open']}",
        f"報告雜湊 {report['report_hash']}",
        "",
    ]
    for c in report["cases"]:
        types = ", ".join(c["actual_flag_types"]) or "—"
        lines.append(f"  [{mark[c['outcome']]}] {c['id']} {c['title']}：{c['actual_status']}（{types}）")
    return "\n".join(lines)


def main() -> int:
    report = run_redteam()
    print(format_report(report))
    return 1 if report["missed"] or report["false_positives"] else 0


if __name__ == "__main__":
    sys.exit(main())
