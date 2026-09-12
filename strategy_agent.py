import json
import logging
import os
import random
import re

import openai
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "你是一個世界頂尖的保險商品創新精算師與產品經理。"
    "你的任務是根據「最新時事新聞」與「精算引擎提供的風險數據」，草擬一款市面上尚未覆蓋的保險商品提案。"
    "這是給商品企劃部門的內部提案草稿，仍需人工審核與送審，請務實、具體、可執行。"
)

# The six sections of a proposal. Each is produced twice by the agent: in Traditional Chinese (the key itself)
# and in English (the key with an "_en" suffix), so the Word report can print both languages side by side.
_FIELD_DESCRIPTIONS = {
    "product_name": "創新保險商品名稱 (具備行銷吸引力)",
    "target_audience": "目標客群分析 (哪些人最需要這個保險)",
    "market_gap": "市場缺口說明 (為何現有保險無法涵蓋此風險)",
    "coverage_details": "保障範圍與理賠條件 (條列式說明)",
    "exclusions": "除外不保事項 (道德風險防範)",
    "business_logic": "商業邏輯與精算數據結合說明 (解釋保費是否具備競爭力，預期獲利模式)",
}
PROPOSAL_FIELDS = tuple(_FIELD_DESCRIPTIONS)

# The trigger headline and summary come from news feeds in either language, so the agent hands back both
# versions; the one already in the original language is a verbatim copy. They live next to source_news /
# news_summary in proposal_data, not inside the proposal itself.
_NEWS_TRANSLATION_DESCRIPTIONS = {
    "source_news_zh": "觸發新聞標題的繁體中文版（原文已是中文則逐字照抄）",
    "source_news_en": "English version of the trigger headline (copy it verbatim if it is already English)",
    "news_summary_zh": "觸發新聞摘要的繁體中文版（原文已是中文則逐字照抄）",
    "news_summary_en": "English version of the trigger news summary (copy it verbatim if it is already English)",
}
NEWS_TRANSLATION_FIELDS = tuple(_NEWS_TRANSLATION_DESCRIPTIONS)


def _tool_properties() -> dict:
    properties = {}
    for field, description in _FIELD_DESCRIPTIONS.items():
        properties[field] = {"type": "string", "description": f"{description}，繁體中文"}
        properties[f"{field}_en"] = {
            "type": "string",
            "description": f"English version of {field}: the same content as {field}, written in fluent English",
        }
    for field, description in _NEWS_TRANSLATION_DESCRIPTIONS.items():
        properties[field] = {"type": "string", "description": description}
    return properties


def _split_news_translation(args: dict) -> dict:
    """Move the news translations out of the tool-call arguments so `proposal` keeps only the six sections."""
    return {field: (args.pop(field, "") or "") for field in NEWS_TRANSLATION_FIELDS}


_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "propose_new_insurance_product",
            "description": "生成全新保險商品開發提案（每個欄位同時提供繁體中文版與英文版）",
            "parameters": {
                "type": "object",
                "properties": _tool_properties(),
                "required": [name for field in PROPOSAL_FIELDS for name in (field, f"{field}_en")]
                            + list(NEWS_TRANSLATION_FIELDS),
            },
        },
    }
]

_TOOL_CHOICE = {"type": "function", "function": {"name": "propose_new_insurance_product"}}


def _model() -> str:
    if os.getenv("FEATHERLESS_API_KEY"):
        return os.getenv("FEATHERLESS_MODEL", "deepseek-ai/DeepSeek-V3.2")
    return os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def _make_client(timeout: float = 90.0) -> OpenAI:
    """建立 LLM client。支援 Featherless AI (GIBC V2 贊助商)、Gemini 與原生 OpenAI。"""
    featherless_key = os.getenv("FEATHERLESS_API_KEY")
    if featherless_key:
        base_url = os.getenv("FEATHERLESS_BASE_URL", "https://api.featherless.ai/v1")
        return OpenAI(
            api_key=featherless_key,
            base_url=base_url,
            timeout=timeout,
        )

    return OpenAI(
        api_key=os.getenv("OPENAI_API_KEY", ""),
        base_url=os.getenv("OPENAI_BASE_URL") or None,
        timeout=timeout,
    )


def _extra_params() -> dict:
    """Gemini 3.x 是推理模型，降低推理強度可把回應時間從 ~27 秒壓到幾秒。"""
    if _model().startswith("gemini"):
        return {"reasoning_effort": "low"}
    return {}


def _fallback_model():
    return os.getenv("OPENAI_FALLBACK_MODEL") or None


def _chat(client, **kwargs):
    """
    chat.completions.create 以主模型呼叫；被限流 (429) 時改用 OPENAI_FALLBACK_MODEL 重試一次。
    Gemini 免費層每個模型的每日額度分開計算，備援模型能撐過主模型額度用盡的情況。
    """
    primary = _model()
    try:
        return client.chat.completions.create(model=primary, **kwargs)
    except openai.RateLimitError:
        fallback = _fallback_model()
        if not fallback or fallback == primary:
            raise
        logger.warning(f"模型 {primary} 被限流 (429)，改用備援模型 {fallback}")
        return client.chat.completions.create(model=fallback, **kwargs)


def _parse_choice_index(text: str, total: int):
    """從 LLM 回覆中取出 0..total-1 的索引；取不到或超出範圍回傳 None。"""
    m = re.search(r"\d+", text or "")
    if not m:
        return None
    idx = int(m.group())
    return idx if 0 <= idx < total else None


def select_best_news(news_items: list[dict]) -> dict:
    """用 LLM 從多則新聞中挑最適合開發保險商品的一則；失敗則隨機挑選。"""
    if not os.getenv("OPENAI_API_KEY"):
        logger.warning("無 LLM API Key，回退至隨機挑選新聞。")
        return random.choice(news_items)

    logger.info("呼叫 LLM 挑選最具潛力的時事新聞...")
    try:
        client = _make_client(timeout=60.0)
        news_text = "\n".join(f"[{i}] {n['title']} - {n.get('summary', '')[:200]}" for i, n in enumerate(news_items))
        response = _chat(
            client,
            messages=[
                {"role": "system", "content": (
                    "你是一個保險風險分析師。請從以下新聞中，挑選出「最適合用來設計創新保險商品」的一則："
                    "要有明確的受災或受損族群、風險可量化、且現有保險可能覆蓋不足。"
                    "只回答該則新聞的索引數字，例如 0、1、2，不要回答其他內容。")},
                {"role": "user", "content": news_text},
            ],
            temperature=0.3,
            max_tokens=512,  # 推理模型的思考 token 也算在內，太小會回傳空內容
            **_extra_params(),
        )
        choice = response.choices[0]
        raw = choice.message.content
        idx = _parse_choice_index(raw, len(news_items))
        if idx is None:
            logger.warning(f"LLM 回覆無法解析為索引（原始回覆: {raw!r}, finish_reason={choice.finish_reason}），回退至隨機挑選。")
            return random.choice(news_items)
        return news_items[idx]
    except Exception as e:
        logger.error(f"LLM 挑選新聞失敗：{e}。回退至隨機挑選。")
        return random.choice(news_items)


def _mock_proposal(news_item: dict) -> dict:
    text = (news_item["title"] + " " + news_item.get("summary", "")).lower()
    if any(k in text for k in ["cyber", "hack", "ransomware", "data", "outage", "cloud", "駭客", "勒索", "資安", "中斷"]):
        return {
            "product_name": "企業數位營運中斷綜合險 (Mock)",
            "product_name_en": "Enterprise Digital Business Interruption Insurance (Mock)",
            "target_audience": "高度依賴雲端服務與線上交易的中小企業與數位平台。",
            "target_audience_en": "SMEs and digital platforms that depend heavily on cloud services and online transactions.",
            "market_gap": "現有資安險僅賠償資料庫重建，不涵蓋第三方雲端服務中斷造成的營業損失與談判專家費用。",
            "market_gap_en": "Existing cyber policies only pay for database rebuilds; they exclude business income lost to third-party cloud outages and negotiator fees.",
            "coverage_details": "1. 第三方雲端服務中斷逾 4 小時，每日補償 5000 美金。\n2. 補助最高 10 萬美金之資安事件應變顧問費。",
            "coverage_details_en": "1. USD 5,000 per day once a third-party cloud outage exceeds 4 hours.\n2. Up to USD 100,000 for incident-response consultants.",
            "exclusions": "1. 企業未安裝基礎防火牆與防毒軟體。\n2. 內部人員蓄意行為。",
            "exclusions_en": "1. No basic firewall or antivirus in place.\n2. Deliberate acts by insiders.",
            "business_logic": "數位依賴度攀升，潛在需求大。以參數化觸發條件降低理賠勘查成本，並透過再保分散風險。",
            "business_logic_en": "Digital dependence keeps rising, so demand is large. Parametric triggers cut claims-adjustment cost and reinsurance spreads the risk.",
        }
    if any(k in text for k in ["health", "pandemic", "disease", "virus", "疫情", "傳染"]):
        return {
            "product_name": "新興傳染病營業中斷與防疫險 (Mock)",
            "product_name_en": "Emerging Infectious Disease Business Interruption Insurance (Mock)",
            "target_audience": "餐飲業、旅遊業與零售實體店家。",
            "target_audience_en": "Restaurants, travel operators and brick-and-mortar retailers.",
            "market_gap": "傳統營業中斷險需有「實體財物損毀」才理賠，傳染病停業無法獲賠。",
            "market_gap_en": "Traditional business interruption cover requires physical damage, so closures caused by an epidemic are not paid.",
            "coverage_details": "1. 政府宣布三級警戒即刻啟動理賠。\n2. 補助員工遠端辦公軟硬體建置費。",
            "coverage_details_en": "1. Claims trigger the moment the government declares a level-3 alert.\n2. Subsidy for remote-work hardware and software.",
            "exclusions": "1. 已被世界衛生組織宣告為全球大流行後才投保。\n2. 企業自行決定停業(非政府強制)。",
            "exclusions_en": "1. Policies bought after the WHO has declared a pandemic.\n2. Voluntary closures not mandated by the government.",
            "business_logic": "將理賠條件參數化(政府公告)，省去人工理賠勘驗成本，保費可有效降低。",
            "business_logic_en": "A parametric trigger (the government announcement) removes manual loss adjustment, which keeps the premium low.",
        }
    return {
        "product_name": "氣候巨災參數型保證險 (Mock)",
        "product_name_en": "Climate Catastrophe Parametric Insurance (Mock)",
        "target_audience": "容易受極端氣候影響之農漁業及運輸業。",
        "target_audience_en": "Farming, fishing and transport businesses exposed to extreme weather.",
        "market_gap": "現有保險需人工勘損，耗時數月。此商品結合氣象數據，觸發參數即刻理賠。",
        "market_gap_en": "Existing cover needs manual loss surveys that take months. This product pays immediately once a weather-data trigger is hit.",
        "coverage_details": "1. 降雨量連續 3 日超過 500mm 自動理賠 100萬。\n2. 因颱風導致之營業中斷固定補償 50萬。",
        "coverage_details_en": "1. Automatic payout of 1,000,000 when rainfall exceeds 500 mm for 3 consecutive days.\n2. Fixed 500,000 for typhoon-caused business interruption.",
        "exclusions": "1. 未依氣象署發布之警告進行預防。\n2. 人為蓄意破壞。",
        "exclusions_en": "1. Failure to act on Central Weather Administration warnings.\n2. Deliberate human damage.",
        "business_logic": "預期損失極大但機率較低，透過再保險分散風險，保費利潤率預期可達 35%。",
        "business_logic_en": "Very large expected loss at low probability; reinsurance spreads the risk and the premium margin is expected to reach 35%.",
    }



def _actuarial_brief(actuarial_data: dict) -> str:
    """Numbers from the actuarial engine plus, when available, where each of them comes from."""
    lines = [
        "【精算引擎數據提供】",
        f"- 預估風險發生機率：{actuarial_data['probability_pct']}%",
        f"- 預估單次事故損失：USD {actuarial_data['expected_loss_usd']}",
        f"- 建議保費區間：USD {actuarial_data['premium_range_usd'][0]} ~ {actuarial_data['premium_range_usd'][1]}",
    ]
    basis = actuarial_data.get("basis")
    if basis:
        source = basis.get("probability_source")
        if source and source != "assumption":
            lines.append(f"- 機率依據：{source}；方法：{basis.get('probability_method', '')}")
        else:
            lines.append(f"- 機率依據：假設值，無官方統計（{basis.get('probability_method', '')}）")
        lines.append(f"- 損失依據：假設值（{basis.get('assumed_loss_note') or basis.get('loss_method', '')}）")
        if basis.get("low_sample"):
            lines.append("- 注意：嚴重事件樣本少於 5 筆，機率估計不確定性高，提案中請揭露。")
        lines.append("- 引用以上數字時請如實標明真實統計與假設值，不要捏造其他資料來源。")
    return "\n".join(lines) + "\n"


def _vision_underwriter_brief(actuarial_data: dict) -> str:
    basis = actuarial_data.get("basis") or {}
    vu = basis.get("vision_underwriting_gpu")
    bge = basis.get("bge_m3_retrieval_gpu")
    lines = ["【AMD ROCm 客觀多模態核保與條款分析佐證】"]
    if vu:
        lines.append(f"- 客觀影像辨識引擎：{vu.get('engine', 'AMD ROCm')} ({vu.get('device', 'GPU Tensor Core')})")
        lines.append(f"- 災損嚴重度等級：{vu.get('severity_grade', 'N/A')}")
        lines.append(f"- 推估積淹水深度：{vu.get('estimated_inundation_depth_cm', 0)} cm")
        lines.append(f"- 影像防偽異常風險：{vu.get('fraud_anomaly_score', 0)} ({vu.get('tamper_status', 'AUTHENTIC')})")
        lines.append(f"- 建議核保處置：{vu.get('underwriting_action', 'VERIFIED')}")
    if bge:
        lines.append(f"- 條款檢索引擎：{bge.get('engine', 'BGE-M3')} (維度 {bge.get('embedding_dimension', 1024)}, 延遲 {bge.get('retrieval_latency_ms', 1.2)} ms)")
    return "\n".join(lines) + "\n"


def generate_product_proposal(news_item: dict, gap_analysis: dict, actuarial_data: dict, on_stage=None) -> dict:
    """
    多代理人辯論：PM 提案 → 核保批評 → 精算師整合並以 function calling 產出正式提案。
    on_stage(stage, text) 可選，用於把每個階段的輸出即時推給前端。
    """
    def emit(stage: str, text: str):
        if on_stage:
            try:
                on_stage(stage, text)
            except Exception as e:  # 推播失敗不應中斷 pipeline
                logger.warning(f"on_stage 回呼失敗: {e}")

    pm_message = (
        f"{gap_analysis['gap_analysis_prompt']}\n\n"
        f"{_actuarial_brief(actuarial_data)}\n"
        f"請初步草擬一份具市場破壞力、但仍可商業化的保險商品點子。"
    )

    # Kept outside the try so a failure on a later call does not discard the debate text that the earlier
    # calls already produced and streamed to the UI.
    pm_idea = ""
    uw_critique = ""
    try:
        if not os.getenv("OPENAI_API_KEY"):
            raise ValueError("No API Key")

        client = _make_client()
        model = _model()
        extra = _extra_params()
        logger.info(f"呼叫 LLM ({model}) 多代理人辯論 (PM vs Underwriter vs Actuary)...")

        pm_response = _chat(
            client,
            messages=[
                {"role": "system", "content": "你是一位激進的保險產品經理，目標是發明最吸引眼球、但仍可商業化的新形態保險。請用繁體中文、300 字內。"},
                {"role": "user", "content": pm_message},
            ],
            temperature=0.8,
            max_tokens=3000,  # Gemini 推理 token 也計入上限，800 會把正文截到只剩幾十字
            **extra,
        )
        pm_idea = pm_response.choices[0].message.content or ""
        logger.info("PM 提案完成。")
        emit("pm", pm_idea)

        uw_prompt = (
            f"這是 PM 提出的點子：\n\n{pm_idea}\n\n"
            f"{_vision_underwriter_brief(actuarial_data)}\n"
            f"請嚴厲批評並指出可能導致虧損的 3 大漏洞，同時評估上述 AMD ROCm 客觀多模態影像佐證是否足以防範道德風險與虛假理賠："
        )
        uw_response = _chat(
            client,
            messages=[
                {"role": "system", "content": "你是一位嚴格且保守的資深核保人員，負責找出保險點子中的道德風險、逆選擇與理賠漏洞。請用繁體中文、300 字內。"},
                {"role": "user", "content": uw_prompt},
            ],
            temperature=0.4,
            max_tokens=3000,
            **extra,
        )
        uw_critique = uw_response.choices[0].message.content or ""
        logger.info("核保人員批評完成。")
        emit("underwriter", uw_critique)

        final_message = (
            f"【觸發新聞】\n標題：{news_item['title']}\n摘要：{news_item.get('summary', '')}\n\n"
            f"【原始提案】\n{pm_idea}\n\n"
            f"【核保人員批評】\n{uw_critique}\n\n"
            f"請扮演精算師，修正這些漏洞，並嚴謹地呼叫 propose_new_insurance_product 生成最終正式提案。"
            f"每個欄位都要同時提供繁體中文版與英文版（*_en 欄位），兩個版本內容必須一致，報告會中英並列呈現。"
            f"另外把觸發新聞的標題與摘要翻成另一種語言（source_news_zh/en、news_summary_zh/en），原文語言的那一版逐字照抄。"
        )
        final_response = _chat(
            client,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": final_message},
            ],
            tools=_TOOLS,
            tool_choice=_TOOL_CHOICE,
            temperature=0.7,
            max_tokens=6000,  # twelve fields (six sections x two languages) plus reasoning tokens
            **extra,
        )
        tool_calls = final_response.choices[0].message.tool_calls
        if not tool_calls:
            raise ValueError("LLM 未回傳 tool_calls")
        args = json.loads(tool_calls[0].function.arguments)
        news_translation = _split_news_translation(args)
        logger.info(f"多代理人策略生成成功！商品名稱：{args['product_name']}")
        emit("actuary", args.get("business_logic", ""))

        return {
            "source_news": news_item["title"],
            "news_summary": news_item.get("summary", ""),
            "news_link": news_item.get("link", ""),
            **news_translation,
            "actuarial_data": actuarial_data,
            "debate": {"pm": pm_idea, "underwriter": uw_critique},
            "proposal": args,
            "is_mock": False,
            "model": getattr(final_response, "model", None) or model,
        }

    except Exception as e:
        logger.error(f"LLM 呼叫失敗或無 API Key：{e}。切換至 Mock 提案（已標記 is_mock）。")
        return {
            "source_news": news_item["title"],
            "news_summary": news_item.get("summary", ""),
            "news_link": news_item.get("link", ""),
            "actuarial_data": actuarial_data,
            "debate": {"pm": pm_idea, "underwriter": uw_critique},
            "proposal": _mock_proposal(news_item),
            "is_mock": True,
            "model": None,
        }
