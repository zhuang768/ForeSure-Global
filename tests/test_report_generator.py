from docx import Document

from report_generator import generate_report

PROPOSAL = {"product_name": "颱風參數險", "target_audience": "t", "market_gap": "g",
            "coverage_details": "c", "exclusions": "e", "business_logic": "b"}
PROPOSAL_EN = {"product_name_en": "Typhoon Parametric Cover", "target_audience_en": "audience-en",
               "market_gap_en": "gap-en", "coverage_details_en": "coverage-en",
               "exclusions_en": "exclusions-en", "business_logic_en": "logic-en"}
BASIS = {
    "peril": "typhoon",
    "probability_source": "內政部消防署 臺灣地區天然災害損失統計表 1958-2025 (https://www.nfa.gov.tw/cht/index.php?code=list&ids=233)",
    "probability_source_en": "National Fire Agency, Ministry of the Interior: Natural Disaster Loss Statistics for Taiwan 1958-2025",
    "probability_method": "share of years 1995-2025 with at least one typhoon event destroying >= 50 households (full + half)",
    "annual_frequency": 0.6129, "low_sample": False,
    "loss_source": "assumption",
    "loss_method": "mean households destroyed per severe event x assumed loss per household",
    "assumed_loss_per_household_usd": 46875.0,
    "assumed_loss_note": "NT$1,500,000 full-loss benefit of the residential earthquake basic insurance, at NT$32/USD",
    "premium_method": "annual expected loss (annual frequency x loss per event) x markup",
}
ACTUARIAL = {"probability_pct": 51.61, "expected_loss_usd": 14447368.42,
             "premium_range_usd": [15938709.68, 26564516.13], "basis": BASIS}


def _text_of(path):
    return "\n".join(p.text for p in Document(path).paragraphs)


def test_report_lists_the_basis_of_each_actuarial_figure(tmp_path):
    data = {"proposal": PROPOSAL, "source_news": "n", "news_summary": "s", "actuarial_data": ACTUARIAL}

    text = _text_of(generate_report(data, output_dir=str(tmp_path)))

    assert "51.61%" in text
    assert "消防署" in text and "nfa.gov.tw" in text
    assert "假設" in text and "46875" in text


def test_report_without_basis_still_renders(tmp_path):
    data = {"proposal": PROPOSAL, "source_news": "n", "news_summary": "s",
            "actuarial_data": {"probability_pct": 4.57, "expected_loss_usd": 41839.45,
                               "premium_range_usd": [3495.69, 5825.49]}}

    text = _text_of(generate_report(data, output_dir=str(tmp_path)))

    assert "4.57%" in text
    assert "依據" not in text


def test_report_headings_and_labels_are_bilingual(tmp_path):
    data = {"proposal": PROPOSAL, "source_news": "n", "news_summary": "s", "actuarial_data": ACTUARIAL}

    text = _text_of(generate_report(data, output_dir=str(tmp_path)))

    for zh, en in [("創新保險商品開發提案書", "Innovative Insurance Product Proposal"),
                   ("市場缺口", "Market Gap"), ("目標客群", "Target Audience"),
                   ("除外不保事項", "Exclusions"), ("預估風險發生機率", "Estimated probability"),
                   ("建議保費定價區間", "Suggested premium range"), ("數據依據", "Basis"),
                   ("發生機率依據", "Probability source"), ("保費計算", "Premium method")]:
        assert zh in text, zh
        assert en in text, en
    assert "National Fire Agency" in text   # English name of the statistics source


def test_report_renders_english_version_of_every_proposal_field(tmp_path):
    data = {"proposal": {**PROPOSAL, **PROPOSAL_EN}, "source_news": "n", "news_summary": "s",
            "actuarial_data": ACTUARIAL}

    path = generate_report(data, output_dir=str(tmp_path))
    text = _text_of(path)

    for value in PROPOSAL.values():
        assert value in text
    for value in PROPOSAL_EN.values():
        assert value in text
    assert "Typhoon_Parametric_Cover" in path       # English name lands in the filename too
    assert "English version not provided" not in text


def test_report_flags_missing_english_instead_of_failing(tmp_path):
    data = {"proposal": PROPOSAL, "source_news": "n", "news_summary": "s", "actuarial_data": ACTUARIAL}

    text = _text_of(generate_report(data, output_dir=str(tmp_path)))

    assert "English version not provided" in text


def test_low_sample_warning_is_bilingual(tmp_path):
    data = {"proposal": PROPOSAL, "source_news": "n", "news_summary": "s",
            "actuarial_data": {**ACTUARIAL, "basis": {**BASIS, "low_sample": True}}}

    text = _text_of(generate_report(data, output_dir=str(tmp_path)))

    assert "樣本少於 5 筆" in text and "Fewer than 5 severe events" in text


def test_error_report_is_bilingual(tmp_path):
    text = _text_of(generate_report({"error": "boom"}, output_dir=str(tmp_path)))

    assert "無法生成完整報告" in text and "could not be generated" in text and "boom" in text


def _hyperlinks_of(path):
    """(text, target url) of every hyperlink in the document body."""
    import re
    import zipfile
    z = zipfile.ZipFile(path)
    body = z.read("word/document.xml").decode()
    rels = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"[^>]*TargetMode="External"', z.read("word/_rels/document.xml.rels").decode()))
    links = []
    for rid, inner in re.findall(r'<w:hyperlink[^>]*r:id="(rId\d+)"[^>]*>(.*?)</w:hyperlink>', body, flags=re.S):
        links.append(("".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", inner)), rels.get(rid)))
    return links


def test_trigger_news_is_translated_and_the_headline_links_to_the_source(tmp_path):
    data = {"proposal": PROPOSAL, "actuarial_data": ACTUARIAL,
            "source_news": "Families lost weeks of food", "news_summary": "Power outages spoiled groceries.",
            "news_link": "https://news.example.com/story",
            "source_news_zh": "家庭損失數週糧食", "source_news_en": "Families lost weeks of food",
            "news_summary_zh": "停電讓食材腐壞。", "news_summary_en": "Power outages spoiled groceries."}

    path = generate_report(data, output_dir=str(tmp_path))
    text = _text_of(path)

    assert "家庭損失數週糧食" in text and "Families lost weeks of food" in text
    assert "停電讓食材腐壞。" in text and "Power outages spoiled groceries." in text
    assert "translation not provided" not in text
    assert ("家庭損失數週糧食", "https://news.example.com/story") in _hyperlinks_of(path)
    assert ("https://news.example.com/story", "https://news.example.com/story") in _hyperlinks_of(path)


def test_trigger_news_without_translation_keeps_the_original_and_says_so(tmp_path):
    data = {"proposal": PROPOSAL, "actuarial_data": ACTUARIAL,
            "source_news": "颱風來襲", "news_summary": "南部淹水。", "news_link": ""}

    path = generate_report(data, output_dir=str(tmp_path))
    text = _text_of(path)

    assert "颱風來襲" in text and "南部淹水。" in text
    assert "translation not provided" in text
    assert _hyperlinks_of(path) == []       # no link, no hyperlink, no crash


def test_one_sided_translation_uses_the_original_for_the_other_language(tmp_path):
    data = {"proposal": PROPOSAL, "actuarial_data": ACTUARIAL,
            "source_news": "Storm hits the south", "news_summary": "s", "news_link": "https://x",
            "source_news_zh": "風暴襲擊南部"}

    text = _text_of(generate_report(data, output_dir=str(tmp_path)))

    assert "風暴襲擊南部" in text and "Storm hits the south" in text


GROUNDING_FAIL = {
    "status": "fail", "checker_version": "grounding-check/v1",
    "checked_claims": 3, "grounded_claims": 2, "flag_count": 1,
    "evidence_sources": ["actuarial_engine", "news", "matched_products"],
    "flags": [{"type": "unsupported_number", "severity": "high", "field": "business_logic", "value": "35%",
               "excerpt": "透過再保險分散風險，保費利潤率預期可達 35%。",
               "message": "「35%」對不回精算引擎輸出、新聞原文或既有商品資料"}],
}


def test_report_spells_out_the_grounding_verdict_and_every_flag(tmp_path):
    data = {"proposal": PROPOSAL, "source_news": "n", "news_summary": "s",
            "actuarial_data": {"probability_pct": 51.61, "expected_loss_usd": 14447368.42,
                               "premium_range_usd": [15938709.68, 26564516.13]},
            "grounding": GROUNDING_FAIL}

    text = _text_of(generate_report(data, output_dir=str(tmp_path)))

    assert "幻覺檢測" in text and "Grounding Check" in text
    assert "未通過" in text
    assert "無來源的數字" in text and "business_logic" in text and "35%" in text
    assert "保費利潤率預期可達 35%" in text
    assert "grounding-check/v1" in text


def test_report_without_grounding_has_no_grounding_section(tmp_path):
    data = {"proposal": PROPOSAL, "source_news": "n", "news_summary": "s",
            "actuarial_data": {"probability_pct": 4.57, "expected_loss_usd": 41839.45,
                               "premium_range_usd": [3495.69, 5825.49]}}

    text = _text_of(generate_report(data, output_dir=str(tmp_path)))

    assert "幻覺檢測" not in text
