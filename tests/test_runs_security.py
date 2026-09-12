import pytest
from fastapi.testclient import TestClient

import apigee_target
import run_store

AUTH = {"Authorization": "Bearer MOCK_APIGEE_TOKEN"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(run_store, "AUDIT_LOG_PATH", str(tmp_path / "audit_log.json"))
    run_store.reset_active_runs()
    apigee_target.rate_limit_records.clear()
    monkeypatch.setattr(apigee_target, "run_pipeline", lambda emit=None: emit("done", {"decision_id": "d"}))
    return TestClient(apigee_target.app)


def test_starting_a_run_requires_token(client):
    assert client.post("/api/v1/runs").status_code in (401, 403)
    assert client.post("/api/v1/runs", headers=AUTH).status_code == 200


def test_verify_requires_token(client):
    run_store.save_run({"decision_id": "d", "blockchain_receipt": {"decision_id": "d", "payload": {}}})
    assert client.post("/api/v1/runs/d/verify").status_code in (401, 403)


def test_read_only_endpoints_stay_open_for_event_source(client):
    assert client.get("/api/v1/runs").status_code == 200
    run_id = client.post("/api/v1/runs", headers=AUTH).json()["run_id"]
    assert client.get(f"/api/v1/runs/{run_id}/events").status_code == 200


def test_rate_limit_applies_to_starting_runs(client, monkeypatch):
    monkeypatch.setattr(apigee_target, "RATE_LIMIT", 2)
    codes = [client.post("/api/v1/runs", headers=AUTH).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_sse_error_event_does_not_leak_exception_details(client, monkeypatch):
    def exploding_pipeline(emit=None):
        raise RuntimeError("secret internal path /Users/x/.env")

    monkeypatch.setattr(apigee_target, "run_pipeline", exploding_pipeline)
    run_id = client.post("/api/v1/runs", headers=AUTH).json()["run_id"]

    body = client.get(f"/api/v1/runs/{run_id}/events").text

    assert "event: error" in body
    assert "secret internal path" not in body


def test_a_second_run_is_refused_while_one_is_still_running(client):
    """Two pipelines in flight would take the same Sepolia nonce and both write audit_log.json."""
    in_flight = run_store.create_run()

    assert client.post("/api/v1/runs", headers=AUTH).status_code == 409

    run_store.mark_finished(in_flight, "finished")
    assert client.post("/api/v1/runs", headers=AUTH).status_code == 200


def test_a_stale_running_entry_does_not_block_forever(client, monkeypatch):
    """A worker that died without marking its run finished must not lock the demo out."""
    stale = run_store.create_run()
    run_store.get_active(stale)["created_at"] -= run_store.STALE_RUN_SECONDS + 1

    assert client.post("/api/v1/runs", headers=AUTH).status_code == 200
