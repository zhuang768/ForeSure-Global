import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def app_with_origins(monkeypatch):
    monkeypatch.setenv("ATLAS_SKIP_WARMUP", "1")
    monkeypatch.setenv("ATLAS_ALLOWED_ORIGINS", "http://localhost:3000, https://atlas-demo.pages.dev")
    import apigee_target
    module = importlib.reload(apigee_target)
    yield TestClient(module.app)
    monkeypatch.delenv("ATLAS_ALLOWED_ORIGINS")
    importlib.reload(apigee_target)


def _preflight(client, origin):
    return client.options("/api/v1/all_reports", headers={
        "Origin": origin, "Access-Control-Request-Method": "GET"})


def test_listed_origin_is_allowed(app_with_origins):
    resp = _preflight(app_with_origins, "https://atlas-demo.pages.dev")
    assert resp.headers.get("access-control-allow-origin") == "https://atlas-demo.pages.dev"


def test_other_pages_dev_subdomain_is_rejected(app_with_origins):
    resp = _preflight(app_with_origins, "https://evil.pages.dev")
    assert resp.headers.get("access-control-allow-origin") is None
