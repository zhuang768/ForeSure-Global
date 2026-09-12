import chain_writer


def _force_mock(monkeypatch):
    monkeypatch.setattr(chain_writer, "use_fallback", True)
    monkeypatch.setattr(chain_writer.time, "sleep", lambda _s: None)


def test_mock_mode_never_fabricates_explorer_link(monkeypatch):
    _force_mock(monkeypatch)

    result = chain_writer.record_decision_on_chain("atlas-test-1", {"a": 1})

    assert result["is_mock"] is True
    assert result["etherscan_url"] is None
    assert result["tx_hash"] is None


def test_audit_wrapper_labels_mock_network_honestly(monkeypatch):
    _force_mock(monkeypatch)

    receipt = chain_writer.audit_proposal_on_chain(
        {"proposal": {"product_name": "X", "market_gap": "Y"}, "actuarial_data": {}}
    )

    assert receipt["is_mock"] is True
    assert receipt["verification_url"] is None
    assert "Sepolia" not in receipt["network"]


def test_audit_wrapper_uses_foresure_decision_id_prefix(monkeypatch):
    _force_mock(monkeypatch)

    receipt = chain_writer.audit_proposal_on_chain(
        {"proposal": {"product_name": "X", "market_gap": "Y"}, "actuarial_data": {}}
    )

    assert receipt["decision_id"].startswith("foresure-")
    assert receipt["payload"]["decision_id"] == receipt["decision_id"]


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


def test_audit_wrapper_survives_a_chain_write_failure(monkeypatch):
    """An RPC timeout or nonce clash must not lose the run: the receipt records the failure instead."""
    import json

    def boom(decision_id, payload):
        raise RuntimeError("nonce too low at https://rpc.example/secret-key")

    monkeypatch.setattr(chain_writer, "record_decision_on_chain", boom)

    receipt = chain_writer.audit_proposal_on_chain({"proposal": {"product_name": "X"}, "actuarial_data": {}})

    assert receipt["is_mock"] is True
    assert receipt["blockchain_tx_hash"] is None and receipt["verification_url"] is None
    assert receipt["chain_error"]                                   # marks the failed write for the UI and the log
    assert "secret-key" not in json.dumps(receipt, ensure_ascii=False)  # raw exception text stays in the server log
    assert receipt["data_hash"] == chain_writer.compute_hash(receipt["payload"]).hex()
    assert "Sepolia" not in receipt["network"]


def test_successful_write_has_no_chain_error(monkeypatch):
    _force_mock(monkeypatch)

    receipt = chain_writer.audit_proposal_on_chain({"proposal": {"product_name": "X"}, "actuarial_data": {}})

    assert receipt["chain_error"] is None
