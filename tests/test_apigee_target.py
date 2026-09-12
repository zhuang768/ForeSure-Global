from fastapi.testclient import TestClient

import apigee_target


def _client():
    return TestClient(apigee_target.app)


def test_knowledge_base_endpoint_returns_product_list():
    response = _client().get("/api/v1/knowledge_base")

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list), body
    assert len(body) >= 30


def test_cors_allows_nextjs_dev_origin():
    response = _client().options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
