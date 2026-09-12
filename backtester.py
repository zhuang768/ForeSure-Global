import logging
import sys
import time
from product_analyzer import find_market_gap
from actuarial_engine import estimate_risk_premium
from strategy_agent import generate_product_proposal
from report_generator import generate_report

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s", handlers=[logging.StreamHandler(sys.stdout)])
logger = logging.getLogger("Backtester")

HISTORICAL_EVENTS = [
    {
        "title": "2021 德州暴風雪造成全州大停電與百億損失",
        "summary": "極端低溫導致德州電網崩潰，無數企業與家庭陷入停電與水管破裂的危機，傳統產險無法涵蓋巨額營業中斷損失。",
        "published": "2021-02-15"
    },
    {
        "title": "2023 夏威夷茂宜島野火",
        "summary": "強風與乾旱引發毀滅性野火，數千棟建築燒毀，當地旅遊業與零售業全面停擺，面臨史無前例的理賠壓力。",
        "published": "2023-08-08"
    }
]

def run_backtest():
    logger.info("="*50)
    logger.info("啟動歷史重大事件回測系統 (Historical Backtesting)...")
    
    for event in HISTORICAL_EVENTS:
        logger.info(f"\n[回測事件]: {event['title']}")
        logger.info("1. 尋找市場缺口...")
        gap_analysis = find_market_gap(event)
        
        logger.info("2. 估算風險機率與預期損失...")
        actuarial_data = estimate_risk_premium(event['summary'], gap_analysis['gap_analysis_prompt'])
        
        logger.info(f" -> 預估單次損失: USD {actuarial_data['expected_loss_usd']}")
        logger.info(f" -> 保費區間: USD {actuarial_data['premium_range_usd'][0]} ~ {actuarial_data['premium_range_usd'][1]}")
        
        logger.info("3. 進行多代理人策略辯論...")
        proposal_data = generate_product_proposal(event, gap_analysis, actuarial_data)
        
        logger.info("4. 產出回測分析報告...")
        report_path = generate_report(proposal_data)
        logger.info(f"✅ {event['title']} 回測完成。")
        time.sleep(2) # 避免 API 頻率過高
        
    logger.info("="*50)
    logger.info("所有歷史事件回測完畢，請至 reports 目錄檢視結果。")

if __name__ == "__main__":
    run_backtest()
