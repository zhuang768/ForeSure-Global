import pytest

import actuarial_engine as ae
import disaster_stats as ds

GAP = "現有商品缺乏針對此事件的參數型保障"
LEGACY_KEYS = {"probability_pct", "expected_loss_usd", "premium_range_usd", "markup_multiplier"}


def test_typhoon_news_prices_from_nfa_frequency_and_labels_sources():
    result = ae.estimate_risk_premium("強烈颱風侵襲南台灣，農作物與漁塭大量損失", GAP)
    stats = ds.peril_statistics("typhoon")

    assert result["probability_pct"] == round(stats["annual_probability"] * 100, 2)
    expected_loss = round(stats["mean_loss_weighted_households"] * ae.ASSUMED_LOSS_PER_HOUSEHOLD_USD, 2)
    assert result["expected_loss_usd"] == expected_loss
    annual_loss = stats["severe_events_per_year"] * expected_loss
    lo, hi = result["markup_multiplier"]
    assert result["premium_range_usd"] == [round(annual_loss * lo, 2), round(annual_loss * hi, 2)]

    basis = result["basis"]
    assert basis["peril"] == "typhoon"
    assert "nfa.gov.tw" in basis["probability_source"]
    assert "National Fire Agency" in basis["probability_source_en"]   # English name for the bilingual report
    assert basis["loss_source"] == "assumption"
    assert basis["assumed_loss_per_household_usd"] == ae.ASSUMED_LOSS_PER_HOUSEHOLD_USD
    assert basis["years_observed"] == stats["years_observed"]
    assert basis["low_sample"] is False


def test_flood_news_flags_thin_sample():
    result = ae.estimate_risk_premium("中南部豪雨成災，多處淹水", GAP)
    assert result["basis"]["peril"] == "flood"
    assert result["basis"]["low_sample"] is True


def test_cyber_news_is_an_assumption_and_deterministic():
    short = ae.estimate_risk_premium("勒索軟體攻擊醫院系統", GAP)
    long = ae.estimate_risk_premium("駭客以勒索軟體癱瘓多家醫院的掛號與病歷系統，要求比特幣贖金", GAP)

    assert short["probability_pct"] == long["probability_pct"] == 8.0
    assert short["expected_loss_usd"] == long["expected_loss_usd"] == 250000.0
    assert short["premium_range_usd"] == long["premium_range_usd"]
    assert short["basis"]["peril"] == "cyber"
    assert short["basis"]["probability_source"] == "assumption"
    assert short["basis"]["loss_source"] == "assumption"


@pytest.mark.parametrize("text,peril,prob", [
    ("醫院爆發傳染病疫情，病例激增", "health", 12.0),
    ("Wildfire and drought across the region", "climate", 15.0),
    ("大型演唱會臨時取消", "general", 5.0),
])
def test_fallback_rules_understand_chinese_and_english(text, peril, prob):
    result = ae.estimate_risk_premium(text, GAP)
    assert result["basis"]["peril"] == peril
    assert result["probability_pct"] == prob


def test_output_keeps_legacy_shape():
    result = ae.estimate_risk_premium("花蓮外海規模 6.2 地震", GAP)
    assert LEGACY_KEYS <= set(result)
    lo, hi = result["premium_range_usd"]
    assert 0 < lo <= hi
    assert result["markup_multiplier"][0] < result["markup_multiplier"][1]


def test_peril_comes_from_the_news_not_from_matched_products():
    gap_with_kb_context = (
        "【最新時事新聞】\n標題：勒索軟體攻擊醫院系統\n摘要：\n\n"
        "【現有相關保險商品】\n- 颱風洪水險：颱風、地震、水災造成之房屋損失\n\n請比對上述時事..."
    )
    result = ae.estimate_risk_premium("勒索軟體攻擊醫院系統", gap_with_kb_context)
    assert result["basis"]["peril"] == "cyber"


def test_empty_summary_falls_back_to_the_gap_text_that_carries_the_title():
    result = ae.estimate_risk_premium("", "【最新時事新聞】\n標題：強烈颱風侵襲南台灣\n摘要：")
    assert result["basis"]["peril"] == "typhoon"
