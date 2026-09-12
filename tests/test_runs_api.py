import json

import pytest
from fastapi.testclient import TestClient

import apigee_target
import run_store

STORED_PAYLOAD = {"decision_id": "atlas-x", "product_name": "X", "probability_pct": 4.57}
AUTH = {"Authorization": "Bearer MOCK_APIGEE_TOKEN"}


@pytest.fixture
def isolated_store(tmp_path, monkeypatch):
    monkeypatch.setattr(run_store, "AUDIT_LOG_PATH", str(tmp_path / "audit_log.json"))
    run_store.reset_active_runs()
    return run_store


def _record(decision_id="atlas-x"):
    return {
        "decision_id": decision_id,
        "timestamp": "20260905_120000",
        "news": {"title": "n1", "summary": "s1", "link": "https://x", "is_mock": False},
        "matched_products": [],
        "actuarial_data": {"probability_pct": 4.57},
        "proposal_data": {"proposal": {"product_name": "X"}, "debate": {"pm": "", "underwriter": ""}},
        "blockchain_receipt": {"decision_id": decision_id, "payload": dict(STORED_PAYLOAD, decision_id=decision_id),
                               "is_mock": False, "blockchain_tx_hash": "0xabc", "verification_url": "https://sepolia.etherscan.io/tx/0xabc"},
        "report_path": "reports/x.docx",
    }


def _fake_pipeline(emit=None):
    emit("news_fetched", [{"title": "n1"}])
    emit("pm", "PM 說")
    record = _record("atlas-fake-1")
    emit("done", record)
    return record


def test_post_run_then_stream_events_until_done(isolated_store, monkeypatch):
    monkeypatch.setattr(apigee_target, "run_pipeline", _fake_pipeline)
    client = TestClient(apigee_target.app)

    run_id = client.post("/api/v1/runs", headers=AUTH).json()["run_id"]

    with client.stream("GET", f"/api/v1/runs/{run_id}/events") as resp:
        assert resp.headers["content-type"].startswith("text/event-stream")
        body = "".join(resp.iter_text())

    assert "event: news_fetched\n" in body
    assert "event: pm\ndata: \"PM 說\"\n\n" in body
    assert body.rstrip().endswith("event: done\ndata: " + json.dumps(_record("atlas-fake-1"), ensure_ascii=False))


def test_events_for_unknown_run_is_404(isolated_store):
    resp = TestClient(apigee_target.app).get("/api/v1/runs/nope/events")
    assert resp.status_code == 404


def test_list_and_get_persisted_runs(isolated_store):
    isolated_store.save_run(_record("atlas-old"))
    isolated_store.save_run(_record("atlas-new"))
    client = TestClient(apigee_target.app)

    listing = client.get("/api/v1/runs").json()
    assert [r["decision_id"] for r in listing] == ["atlas-new", "atlas-old"]
    assert "proposal_data" not in listing[0], "列表只回摘要，不回整份內容"

    detail = client.get("/api/v1/runs/atlas-old").json()
    assert detail["proposal_data"]["proposal"]["product_name"] == "X"
    assert client.get("/api/v1/runs/atlas-missing").status_code == 404


def test_verify_recomputes_from_stored_payload_and_applies_tampering(isolated_store, monkeypatch):
    isolated_store.save_run(_record("atlas-x"))
    seen = []

    def fake_verify(decision_id, payload):
        seen.append(payload)
        return {"decision_id": decision_id, "matched": payload == STORED_PAYLOAD, "is_mock": False}

    monkeypatch.setattr(apigee_target, "verify_decision_on_chain", fake_verify)
    client = TestClient(apigee_target.app)

    ok = client.post("/api/v1/runs/atlas-x/verify", headers=AUTH).json()
    bad = client.post("/api/v1/runs/atlas-x/verify", headers=AUTH, json={"tampered": {"probability_pct": 9.99}}).json()

    assert ok["matched"] is True
    assert bad["matched"] is False
    assert seen[1]["probability_pct"] == 9.99
    assert bad["tampered_fields"] == ["probability_pct"]
