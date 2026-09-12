"""POST /api/v1/knowledge_base writes the file the semantic index is built from."""
import json
import shutil

import pytest
from fastapi.testclient import TestClient

import apigee_target
import product_analyzer

AUTH = {"Authorization": "Bearer MOCK_APIGEE_TOKEN"}
ITEM = {"name": "測試險", "category": "Other", "description": "for tests"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    kb_path = tmp_path / "insurance_kb.json"
    shutil.copy(apigee_target.KB_PATH, kb_path)
    monkeypatch.setattr(apigee_target, "KB_PATH", str(kb_path))
    monkeypatch.setattr(product_analyzer, "KB_PATH", str(kb_path))
    apigee_target.rate_limit_records.clear()
    return TestClient(apigee_target.app)


def test_adding_a_product_requires_a_token(client):
    assert client.post("/api/v1/knowledge_base", json=ITEM).status_code in (401, 403)


def test_added_product_gets_an_id_so_the_index_can_still_be_built(client):
    resp = client.post("/api/v1/knowledge_base", json=ITEM, headers=AUTH)

    assert resp.status_code == 200
    kb = product_analyzer.load_kb()
    assert kb[-1]["name"] == "測試險"
    assert all(item.get("id") for item in kb), "every item needs the id _build_index reads"
    assert len({item["id"] for item in kb}) == len(kb), "ids must stay unique"
    assert resp.json()["item"]["id"] == kb[-1]["id"]


def test_adding_a_product_schedules_a_rebuild_of_the_semantic_index(client, monkeypatch):
    rebuilt = []
    monkeypatch.setattr(product_analyzer, "reindex_async", lambda: rebuilt.append(True))

    client.post("/api/v1/knowledge_base", json=ITEM, headers=AUTH)

    assert rebuilt == [True]


def test_reindex_async_drops_the_stale_index_and_rebuilds_in_the_background(monkeypatch):
    built = []
    monkeypatch.setattr(product_analyzer, "_build_index", lambda: built.append(True) or ("e", "c", {}))
    monkeypatch.setattr(product_analyzer, "_index", ("stale",))

    thread = product_analyzer.reindex_async()
    thread.join(timeout=5)

    assert built == [True]
    assert product_analyzer._index == ("e", "c", {})
