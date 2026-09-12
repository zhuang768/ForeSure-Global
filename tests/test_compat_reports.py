"""隊友前端（首頁與 /generator）使用的攤平報告端點。"""
import pytest
from fastapi.testclient import TestClient

import apigee_target
import run_store

AUTH = {"Authorization": "Bearer MOCK_APIGEE_TOKEN"}


def _record(decision_id, product):
    return {
        "decision_id": decision_id,
        "timestamp": "20260905_120000",
        "news": {"title": f"news for {product}", "summary": "s", "link": "https://x", "is_mock": False},
        "matched_products": [{"id": "INS-010", "name": "網路資安險"}],
        "actuarial_data": {"probability_pct": 4.57, "expected_loss_usd": 41839.45,
                           "premium_range_usd": [3495.69, 5825.49], "markup_multiplier": [1.5, 2.5]},
        "proposal_data": {
            "proposal": {"product_name": product, "target_audience": "t", "market_gap": "g",
                         "coverage_details": "c", "exclusions": "e", "business_logic": "b"},
            "debate": {"pm": "PM", "underwriter": "UW"}, "is_mock": False, "model": "fake",
        },
        "blockchain_receipt": {"decision_id": decision_id, "payload": {}, "data_hash": "ab",
                               "blockchain_tx_hash": "0xabc", "block_number": 1,
                               "verification_url": "https://sepolia.etherscan.io/tx/0xabc",
                               "network": "Ethereum Sepolia Testnet", "is_mock": False, "timestamp": "t"},
        "report_path": "reports/x.docx",
    }


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(run_store, "AUDIT_LOG_PATH", str(tmp_path / "audit_log.json"))
    run_store.reset_active_runs()
    apigee_target.rate_limit_records.clear()
    return TestClient(apigee_target.app)


def test_all_reports_is_chronological_and_flattened(client):
    run_store.save_run(_record("atlas-1", "First"))
    run_store.save_run(_record("atlas-2", "Second"))

    reports = client.get("/api/v1/all_reports").json()

    assert [r["decision_id"] for r in reports] == ["atlas-1", "atlas-2"]
    first = reports[0]
    assert first["proposal"]["product_name"] == "First"
    assert first["source_news"] == "news for First"
    assert first["blockchain_tx_hash"] == "0xabc"
    assert first["verification_url"].endswith("0xabc")
    assert first["actuarial_data"]["probability"] == pytest.approx(0.0457)
    assert first["actuarial_data"]["probability_pct"] == 4.57
    assert first["debate"]["pm"] == "PM"
    assert first["matched_products"][0]["name"] == "網路資安險"


def test_latest_report_returns_newest_or_error(client):
    assert "error" in client.get("/api/v1/latest_report").json()
    run_store.save_run(_record("atlas-1", "First"))
    run_store.save_run(_record("atlas-2", "Second"))

    assert client.get("/api/v1/latest_report").json()["decision_id"] == "atlas-2"


def test_run_agent_requires_token_and_returns_flattened_report(client, monkeypatch):
    monkeypatch.setattr(apigee_target, "run_pipeline", lambda emit=None: _record("atlas-9", "Fresh"))

    assert client.post("/api/v1/run_agent").status_code in (401, 403)
    report = client.post("/api/v1/run_agent", headers=AUTH).json()

    assert report["decision_id"] == "atlas-9"
    assert report["proposal"]["product_name"] == "Fresh"
    assert report["blockchain_tx_hash"] == "0xabc"


def test_run_agent_reports_failure_without_leaking_details(client, monkeypatch):
    def boom(emit=None):
        raise RuntimeError("secret path")

    monkeypatch.setattr(apigee_target, "run_pipeline", boom)

    body = client.post("/api/v1/run_agent", headers=AUTH).json()

    assert "error" in body and "secret path" not in body["error"]

