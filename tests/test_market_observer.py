import market_observer

SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>test</title>
<item>
  <title>颱風重創南台灣農業 - 測試報</title>
  <link>https://example.com/a</link>
  <pubDate>Fri, 05 Sep 2026 01:00:00 GMT</pubDate>
  <description>&lt;a href="https://example.com/a"&gt;颱風重創南台灣農業&lt;/a&gt;&amp;nbsp;&lt;font color="#6f6f6f"&gt;測試報&lt;/font&gt;</description>
</item>
<item>
  <title>醫院遭勒索軟體攻擊 - 測試報</title>
  <link>https://example.com/b</link>
  <description>&lt;p&gt;病歷系統癱瘓三天&lt;/p&gt;</description>
</item>
</channel></rss>"""


def test_parse_feed_strips_html_from_summary():
    items = market_observer.parse_feed(SAMPLE_RSS)
    assert len(items) == 2
    assert items[0]["title"].startswith("颱風重創南台灣農業")
    assert "<" not in items[0]["summary"]
    assert "颱風重創南台灣農業" in items[0]["summary"]
    assert items[1]["summary"] == "病歷系統癱瘓三天"


class _FakeResponse:
    def __init__(self, text, status_code=200):
        self.text = text
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


def test_fetch_uses_requests_and_dedupes_titles_across_feeds(monkeypatch):
    calls = []

    def fake_get(url, headers=None, timeout=None):
        calls.append(url)
        return _FakeResponse(SAMPLE_RSS)

    monkeypatch.setattr(market_observer.requests, "get", fake_get)
    items = market_observer.fetch_trending_news(limit=5)

    assert calls == market_observer.RSS_URLS, "每個 RSS 來源都應透過 requests.get 抓取"
    # 四個 feed 回傳同樣兩則 → 依標題去重後只剩兩則
    assert [item["title"] for item in items] == [
        "颱風重創南台灣農業 - 測試報",
        "醫院遭勒索軟體攻擊 - 測試報",
    ]
    assert all(item["is_mock"] is False for item in items)


def test_fetch_returns_flagged_mock_when_every_feed_fails(monkeypatch):
    def failing_get(url, headers=None, timeout=None):
        raise RuntimeError("network down")

    monkeypatch.setattr(market_observer.requests, "get", failing_get)
    items = market_observer.fetch_trending_news(limit=5)

    assert len(items) == 1
    assert items[0]["is_mock"] is True
