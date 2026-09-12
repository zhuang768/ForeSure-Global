import html
import logging
import re
from urllib.parse import quote

import feedparser
import requests

logger = logging.getLogger(__name__)

# Google News RSS。直接用 feedparser 抓網址在部分 Python 環境會被 SSL 憑證擋下，
# 所以改用 requests 取回文字再交給 feedparser 解析。
_GN = "https://news.google.com/rss/search?q={q}&hl={hl}&gl={gl}&ceid={ceid}"


def _gn(query: str, lang: str = "zh-TW") -> str:
    if lang == "zh-TW":
        return _GN.format(q=quote(query), hl="zh-TW", gl="TW", ceid="TW:zh-Hant")
    return _GN.format(q=quote(query), hl="en-US", gl="US", ceid="US:en")


RSS_URLS = [
    _gn("颱風 OR 地震 OR 豪雨 OR 淹水 when:2d"),
    _gn("駭客 OR 勒索軟體 OR 資安 OR 個資外洩 when:2d"),
    _gn("停電 OR 服務中斷 OR 供應鏈 OR 缺工 when:2d"),
    _gn("disaster OR cyberattack OR outage OR recall when:1d", lang="en"),
]

_HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ForeSureInsuranceAgent/1.0"}
_TIMEOUT = 15

MOCK_NEWS = {
    "title": "全球最大的雲端服務供應商發生連續 12 小時的服務中斷",
    "link": "https://example.com/outage",
    "published": "N/A",
    "summary": "本次中斷導致全球數千家企業無法營運，電子商務與金融交易全面停擺，預估經濟損失高達數十億美元。",
    "source": "模擬資料",
    "is_mock": True,
}


def _strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def parse_feed(xml_text: str) -> list[dict]:
    """把 RSS 文字解析成新聞項目，摘要去除 HTML。"""
    feed = feedparser.parse(xml_text)
    items = []
    for entry in feed.entries:
        title = _strip_html(getattr(entry, "title", ""))
        items.append({
            "title": title,
            "link": getattr(entry, "link", ""),
            "published": getattr(entry, "published", "N/A"),
            "summary": _strip_html(getattr(entry, "summary", "")),
            "source": getattr(getattr(entry, "source", None), "title", "") or "",
            "is_mock": False,
        })
    return items


def fetch_trending_news(limit: int = 5) -> list[dict]:
    """抓取 Google News RSS。全部失敗時回傳一則標記為 is_mock 的模擬新聞。"""
    logger.info("開始抓取 Google News RSS...")
    news_items: list[dict] = []
    seen_titles: set[str] = set()

    for url in RSS_URLS:
        try:
            resp = requests.get(url, headers=_HEADERS, timeout=_TIMEOUT)
            resp.raise_for_status()
            for item in parse_feed(resp.text)[:limit]:
                if item["title"] in seen_titles:
                    continue
                seen_titles.add(item["title"])
                news_items.append(item)
        except Exception as e:
            logger.error(f"抓取 RSS 失敗 {url[:80]}...: {e}")

    if not news_items:
        logger.warning("無法從 Google News 取得資料，切換為模擬新聞（已標記 is_mock）。")
        news_items.append(dict(MOCK_NEWS))

    logger.info(f"共抓取 {len(news_items)} 則新聞。")
    return news_items


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    for n in fetch_trending_news(3):
        print(f"- [{n['source']}] {n['title']}")
