import json
import os

from fastapi.testclient import TestClient

import apigee_target
import grounding_check as gc
import redteam

FRONTEND_SNAPSHOT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "src", "lib", "redteamReport.json"
)


def test_suite_has_attack_control_and_known_gap_cases_with_unique_ids():
    suite = redteam.load_suite()
    ids = [c["id"] for c in suite["cases"]]
    assert len(ids) == len(set(ids))
    assert any(c["attack"] != "none" and not c.get("known_gap") for c in suite["cases"])
    assert any(c["attack"] == "none" for c in suite["cases"]), "沒有對照組就量不出誤報率"
    assert any(c.get("known_gap") for c in suite["cases"]), "紅隊報告要照實列出已知抓不到的攻擊"


def test_every_attack_case_is_detected_and_no_control_case_is_flagged():
    report = redteam.run_redteam()
    assert report["missed"] == 0, [c["id"] for c in report["cases"] if c["outcome"] == "missed"]
    assert report["false_positives"] == 0, [c["id"] for c in report["cases"] if c["outcome"] == "false_positive"]
    assert report["detection_rate"] == 1.0
    assert report["false_positive_rate"] == 0.0


def test_known_gaps_are_reported_but_excluded_from_the_detection_rate():
    report = redteam.run_redteam()
    gaps = [c for c in report["cases"] if c["known_gap"]]
    assert gaps and report["known_gap_cases"] == len(gaps)
    # 已知漏洞不進攻擊組的分母，否則檢出率會被自己承認的漏洞拉低而失去意義
    assert report["attack_cases"] + report["control_cases"] + report["known_gap_cases"] == report["total_cases"]
    assert report["known_gaps_open"] == sum(1 for c in gaps if c["outcome"] == "known_gap")


def test_report_is_deterministic_and_hash_covers_the_results():
    first, second = redteam.run_redteam(), redteam.run_redteam()
    assert first == second
    assert first["report_hash"] == second["report_hash"]
    assert first["checker_version"] == gc.CHECKER_VERSION


def test_report_hash_changes_when_a_verdict_changes():
    suite = redteam.load_suite()
    baseline = redteam.run_redteam(suite)
    tampered = json.loads(json.dumps(suite))
    tampered["cases"][0]["overrides"]["proposal"] = {"business_logic": "年發生機率約 51.6%，屬假設值。"}
    assert redteam.run_redteam(tampered)["report_hash"] != baseline["report_hash"]


def test_a_checker_that_never_flags_anything_scores_zero(monkeypatch):
    """語料本身要有鑑別力：把檢查器換成永遠放行，檢出率必須掉到 0。"""
    monkeypatch.setattr(
        redteam.gc,
        "check_grounding",
        lambda *_: {"status": "pass", "checker_version": "stub", "checked_claims": 0,
                    "grounded_claims": 0, "flag_count": 0, "evidence_sources": [], "flags": []},
    )
    report = redteam.run_redteam()
    assert report["detected"] == 0
    assert report["missed"] == report["attack_cases"] > 0
    assert report["false_positives"] == 0  # 全部放行不會誤報，所以兩個指標必須一起看


def test_a_checker_that_flags_everything_scores_full_false_positives(monkeypatch):
    """反過來也要有鑑別力：亂標一通雖然檢出率滿分，誤報率也會滿分。"""
    monkeypatch.setattr(
        redteam.gc,
        "check_grounding",
        lambda *_: {"status": "fail", "checker_version": "stub", "checked_claims": 0, "grounded_claims": 0,
                   "flag_count": 1, "evidence_sources": [],
                   "flags": [{"type": t, "severity": "high", "field": "business_logic", "value": None, "excerpt": "",
                              "message": ""}
                             for t in ("unsupported_number", "unverified_citation", "missing_disclosure")]},
    )
    report = redteam.run_redteam()
    assert report["false_positives"] == report["control_cases"] > 0
    assert report["false_positive_rate"] == 1.0


def test_cli_exits_zero_while_nothing_is_missed_or_falsely_flagged(capsys):
    assert redteam.main() == 0
    out = capsys.readouterr().out
    assert "紅隊測試台" in out and "檢出率" in out


def test_redteam_endpoint_needs_no_token_and_returns_the_same_report():
    """GET 端點不需要 token（和其他唯讀端點一致），內容必須等於直接呼叫的結果。"""
    res = TestClient(apigee_target.app).get("/api/v1/redteam")
    assert res.status_code == 200
    assert res.json() == redteam.run_redteam()


def test_frontend_offline_snapshot_matches_the_freshly_computed_report():
    """前端離線 demo 讀的是這份快照。它和後端現算的結果必須一致，不然攤位上兩邊會說不同的話。"""
    with open(FRONTEND_SNAPSHOT, "r", encoding="utf-8") as f:
        snapshot = json.load(f)
    assert snapshot == redteam.run_redteam(), "請執行 python scripts/export_redteam_report.py 重新產生快照"
