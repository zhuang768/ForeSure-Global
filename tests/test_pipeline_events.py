import grounding_check
import main

NEWS = [{"title": "n1", "summary": "s1", "link": "https://x", "is_mock": False}]
ACTUARIAL = {"probability_pct": 1.0, "expected_loss_usd": 10.0, "premium_range_usd": [1, 2], "markup_multiplier": [1, 2]}
RECEIPT = {
    "decision_id": "atlas-1", "payload": {"decision_id": "atlas-1"}, "data_hash": "ab",
    "blockchain_tx_hash": None, "block_number": None, "verification_url": None,
    "network": "本地模擬（未上鏈）", "is_mock": True, "timestamp": "t",
}


def _fake_proposal(news, gap, actuarial, on_stage=None):
    on_stage("pm", "PM 說")
    on_stage("underwriter", "核保說")
    on_stage("actuary", "精算說")
    return {
        "source_news": news["title"], "news_summary": news["summary"], "news_link": news["link"],
        "actuarial_data": actuarial, "debate": {"pm": "PM 說", "underwriter": "核保說"},
        "proposal": {"product_name": "X", "target_audience": "t", "market_gap": "g",
                     "coverage_details": "c", "exclusions": "e", "business_logic": "b"},
        "is_mock": False, "model": "fake",
    }


def _wire_fakes(monkeypatch, saved):
    monkeypatch.setattr(main, "fetch_trending_news", lambda limit=5: NEWS)
    monkeypatch.setattr(main, "select_best_news", lambda items: items[0])
    monkeypatch.setattr(main, "find_market_gap", lambda n: {
        "news": n, "matched_products": [{"id": "INS-016", "name": "農業保險", "category": "Property",
                                          "description": "d", "distance": 0.3}],
        "kb_context": "", "gap_analysis_prompt": "p"})
    monkeypatch.setattr(main, "estimate_risk_premium", lambda s, g: ACTUARIAL)
    monkeypatch.setattr(main, "generate_product_proposal", _fake_proposal)
    monkeypatch.setattr(main, "generate_report", lambda pd: "reports/x.docx")
    monkeypatch.setattr(main, "audit_proposal_on_chain", lambda pd: RECEIPT)
    monkeypatch.setattr(main, "save_run", lambda rec: saved.append(rec))
    monkeypatch.setattr(main, "load_runs", lambda: [], raising=False)


def test_run_pipeline_emits_stages_in_order_and_persists(monkeypatch):
    saved, events = [], []
    _wire_fakes(monkeypatch, saved)

    record = main.run_pipeline(emit=lambda stage, data: events.append(stage))

    assert events == [
        "news_fetched", "news_selected", "kb_matched", "actuarial",
        "pm", "underwriter", "actuary", "grounding", "report", "chain_pending", "chain_done", "done",
    ]
    assert record["decision_id"] == "atlas-1"
    assert record["matched_products"][0]["name"] == "農業保險"
    assert record["blockchain_receipt"]["is_mock"] is True
    assert saved == [record]


def test_run_pipeline_works_without_emit_callback(monkeypatch):
    saved = []
    _wire_fakes(monkeypatch, saved)

    record = main.run_pipeline()

    assert record["report_path"] == "reports/x.docx"


def test_run_pipeline_hands_title_and_summary_to_the_actuarial_engine(monkeypatch):
    saved, seen = [], {}
    _wire_fakes(monkeypatch, saved)

    def _capture(summary, gap):
        seen["summary"], seen["gap"] = summary, gap
        return ACTUARIAL

    monkeypatch.setattr(main, "estimate_risk_premium", _capture)

    main.run_pipeline()

    assert "n1" in seen["summary"] and "s1" in seen["summary"]
    assert seen["gap"] == "p"


def _two_items():
    return [NEWS[0], {"title": "n2", "summary": "s2", "link": "https://y", "is_mock": False}]


def test_run_pipeline_skips_news_already_used_in_history(monkeypatch):
    saved, offered = [], []
    _wire_fakes(monkeypatch, saved)
    monkeypatch.setattr(main, "fetch_trending_news", lambda limit=5: _two_items())
    monkeypatch.setattr(main, "load_runs", lambda: [{"news": {"title": "n1"}, "proposal_data": {"source_news": "n1"}}])
    monkeypatch.setattr(main, "select_best_news", lambda items: offered.append([n["title"] for n in items]) or items[0])

    main.run_pipeline()

    assert offered == [["n2"]]


def test_run_pipeline_offers_every_item_again_once_all_were_used(monkeypatch):
    saved, offered = [], []
    _wire_fakes(monkeypatch, saved)
    monkeypatch.setattr(main, "fetch_trending_news", lambda limit=5: _two_items())
    monkeypatch.setattr(main, "load_runs", lambda: [{"proposal_data": {"source_news": "n1"}}, {"news": {"title": "n2"}}])
    monkeypatch.setattr(main, "select_best_news", lambda items: offered.append([n["title"] for n in items]) or items[0])

    main.run_pipeline()

    assert offered == [["n1", "n2"]]


def test_run_pipeline_stores_the_grounding_result_and_hands_it_to_the_report(monkeypatch):
    saved, seen = [], {}
    _wire_fakes(monkeypatch, saved)

    def _capture_report(proposal_data):
        seen["proposal_data"] = proposal_data
        return "reports/x.docx"

    monkeypatch.setattr(main, "generate_report", _capture_report)

    record = main.run_pipeline()

    assert record["grounding"]["status"] == "pass"
    assert record["grounding"]["checker_version"] == grounding_check.CHECKER_VERSION
    assert seen["proposal_data"]["grounding"] is record["grounding"]


def test_a_grounding_check_failure_does_not_abort_the_pipeline(monkeypatch):
    saved, events = [], []
    _wire_fakes(monkeypatch, saved)

    def _boom(proposal_data, news, matched_products):
        raise RuntimeError("boom")

    monkeypatch.setattr(main, "check_grounding", _boom)

    record = main.run_pipeline(emit=lambda stage, data: events.append(stage))

    assert events == [
        "news_fetched", "news_selected", "kb_matched", "actuarial",
        "pm", "underwriter", "actuary", "grounding", "report", "chain_pending", "chain_done", "done",
    ]
    assert record["grounding"] is None
    assert record["proposal_data"]["grounding"] is None
    assert saved == [record]
