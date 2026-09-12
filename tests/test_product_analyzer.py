import product_analyzer

TYPHOON_NEWS = {
    "title": "強烈颱風侵襲南台灣，農作物與漁塭大量損失",
    "summary": "農民求助無門，農委會統計損失超過十億元。",
}

RANSOMWARE_NEWS = {
    "title": "醫院遭勒索軟體攻擊，病歷系統癱瘓三天",
    "summary": "駭客要求支付比特幣贖金，院方緊急啟動紙本作業。",
}


def _top_names(news, n=3):
    result = product_analyzer.find_market_gap(news)
    matches = result["matched_products"]
    assert all({"id", "name", "category", "distance"} <= set(m) for m in matches)
    return [m["name"] for m in matches[:n]]


def test_typhoon_news_matches_agricultural_parametric_insurance():
    names = _top_names(TYPHOON_NEWS)
    assert any("農業保險" in n for n in names), names


def test_ransomware_news_matches_cyber_insurance_first():
    names = _top_names(RANSOMWARE_NEWS, n=1)
    assert "網路資安險" in names[0], names
