import run_store


def test_summarize_falls_back_to_receipt_decision_id_for_legacy_records():
    legacy = {
        "timestamp": "20260905_021125",
        "proposal_data": {"proposal": {"product_name": "舊格式商品"}, "is_mock": False},
        "blockchain_receipt": {"decision_id": "atlas-legacy-1", "is_mock": True},
    }

    summary = run_store.summarize(legacy)

    assert summary["decision_id"] == "atlas-legacy-1"
    assert summary["product_name"] == "舊格式商品"


def test_get_run_matches_legacy_record_by_receipt_decision_id(tmp_path, monkeypatch):
    monkeypatch.setattr(run_store, "AUDIT_LOG_PATH", str(tmp_path / "audit_log.json"))
    run_store.save_run({"proposal_data": {}, "blockchain_receipt": {"decision_id": "atlas-legacy-2"}})

    assert run_store.get_run("atlas-legacy-2") is not None


GROUNDING = {"status": "warn", "flag_count": 1, "checker_version": "grounding-check/v1",
             "flags": [{"type": "missing_disclosure", "severity": "medium", "field": "business_logic"}]}


def _record_with_grounding():
    return {
        "decision_id": "foresure-g1",
        "timestamp": "20260905_150000",
        "news": {"title": "n"},
        "proposal_data": {"proposal": {"product_name": "G"}, "is_mock": False},
        "blockchain_receipt": {"decision_id": "foresure-g1", "is_mock": False, "blockchain_tx_hash": "0xabc"},
        "grounding": GROUNDING,
    }


def test_summarize_exposes_the_grounding_status():
    assert run_store.summarize(_record_with_grounding())["grounding_status"] == "warn"


def test_flatten_report_carries_the_full_grounding_result():
    flat = run_store.flatten_report(_record_with_grounding())
    assert flat["grounding"] == GROUNDING


def test_summary_and_flat_formats_tolerate_records_without_grounding():
    legacy = {
        "timestamp": "20260905_021125",
        "proposal_data": {"proposal": {"product_name": "舊格式商品"}, "is_mock": False},
        "blockchain_receipt": {"decision_id": "atlas-legacy-1", "is_mock": True},
    }
    assert run_store.summarize(legacy)["grounding_status"] is None
    assert run_store.flatten_report(legacy)["grounding"] is None
