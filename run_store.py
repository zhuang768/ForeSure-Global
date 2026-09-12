"""
執行紀錄儲存：
- 持久化：reports/audit_log.json（每次 pipeline 完成寫入一筆完整紀錄，供歷史列表、重播、鏈上驗證）
- 進行中：記憶體內的事件列表，供 SSE 串流
"""
import json
import logging
import os
import threading
import time
import uuid

logger = logging.getLogger(__name__)

_HERE = os.path.dirname(os.path.abspath(__file__))
AUDIT_LOG_PATH = os.path.join(_HERE, "reports", "audit_log.json")

_file_lock = threading.Lock()
_active_lock = threading.Lock()
_active_runs: dict[str, dict] = {}


# ---------- 持久化 ----------

def load_runs() -> list[dict]:
    """全部紀錄，最新在前。"""
    with _file_lock:
        if not os.path.exists(AUDIT_LOG_PATH):
            return []
        try:
            with open(AUDIT_LOG_PATH, "r", encoding="utf-8") as f:
                records = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            logger.error(f"讀取 audit log 失敗: {e}")
            return []
    return list(reversed(records))


def record_decision_id(record: dict):
    """新格式在頂層；早期紀錄只在 blockchain_receipt 裡有 decision_id。"""
    return record.get("decision_id") or (record.get("blockchain_receipt") or {}).get("decision_id")


def get_run(decision_id: str):
    for record in load_runs():
        if record_decision_id(record) == decision_id or record.get("run_id") == decision_id:
            return record
    return None


def save_run(record: dict) -> None:
    with _file_lock:
        os.makedirs(os.path.dirname(AUDIT_LOG_PATH), exist_ok=True)
        records = []
        if os.path.exists(AUDIT_LOG_PATH):
            try:
                with open(AUDIT_LOG_PATH, "r", encoding="utf-8") as f:
                    records = json.load(f)
            except (json.JSONDecodeError, OSError) as e:
                logger.error(f"讀取 audit log 失敗，將重建: {e}")
        records.append(record)
        with open(AUDIT_LOG_PATH, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2)


def flatten_report(record: dict) -> dict:
    """
    首頁與 /generator 頁使用的攤平格式：proposal、actuarial_data、blockchain_tx_hash 都在頂層。
    actuarial_data 額外提供 probability（0 到 1 小數），前端以此乘 100 顯示。
    """
    proposal_data = record.get("proposal_data") or {}
    receipt = record.get("blockchain_receipt") or {}
    news = record.get("news") or {}
    actuarial = dict(record.get("actuarial_data") or proposal_data.get("actuarial_data") or {})
    if "probability_pct" in actuarial and "probability" not in actuarial:
        actuarial["probability"] = round(actuarial["probability_pct"] / 100, 6)
    return {
        "decision_id": record_decision_id(record),
        "timestamp": record.get("timestamp"),
        "source_news": news.get("title") or proposal_data.get("source_news"),
        "news_summary": news.get("summary") or proposal_data.get("news_summary"),
        "news_link": news.get("link") or proposal_data.get("news_link"),
        "proposal": proposal_data.get("proposal") or {},
        "debate": proposal_data.get("debate") or {},
        "is_mock_proposal": proposal_data.get("is_mock"),
        "model": proposal_data.get("model"),
        "matched_products": record.get("matched_products") or [],
        "actuarial_data": actuarial,
        # 幻覺檢測結果；2026-09-05 之前的舊紀錄沒有這一欄，前端要能容忍 None。
        "grounding": record.get("grounding") or proposal_data.get("grounding"),
        "blockchain_tx_hash": receipt.get("blockchain_tx_hash"),
        "block_number": receipt.get("block_number"),
        "verification_url": receipt.get("verification_url"),
        "network": receipt.get("network"),
        "data_hash": receipt.get("data_hash"),
        "chain_is_mock": receipt.get("is_mock"),
        "report_path": record.get("report_path"),
    }


def summarize(record: dict) -> dict:
    """列表用摘要，不含整份提案內容。"""
    receipt = record.get("blockchain_receipt", {}) or {}
    proposal = (record.get("proposal_data", {}) or {}).get("proposal", {}) or {}
    return {
        "decision_id": record_decision_id(record),
        "run_id": record.get("run_id"),
        "timestamp": record.get("timestamp"),
        "news_title": (record.get("news") or {}).get("title"),
        "product_name": proposal.get("product_name"),
        "is_mock_proposal": (record.get("proposal_data") or {}).get("is_mock"),
        "chain_is_mock": receipt.get("is_mock"),
        "tx_hash": receipt.get("blockchain_tx_hash"),
        "verification_url": receipt.get("verification_url"),
        "grounding_status": (record.get("grounding") or {}).get("status"),
    }


# ---------- 進行中的執行 ----------

def reset_active_runs() -> None:
    with _active_lock:
        _active_runs.clear()


# A run that is still "running" after this long is assumed to have died without mark_finished
# (worker crash, server killed mid-run) and no longer blocks a new one. A real run takes 60 to 100 s.
STALE_RUN_SECONDS = 15 * 60


def create_run() -> str:
    run_id = uuid.uuid4().hex[:12]
    with _active_lock:
        _active_runs[run_id] = {"run_id": run_id, "status": "running", "events": [], "created_at": time.time()}
    return run_id


def create_run_if_idle() -> str | None:
    """Register a run only when no other run is in flight; the check and the insert share one lock so two
    simultaneous requests cannot both pass. Returns None when a run is already running."""
    now = time.time()
    with _active_lock:
        for run in _active_runs.values():
            if run["status"] == "running" and now - run["created_at"] < STALE_RUN_SECONDS:
                return None
        run_id = uuid.uuid4().hex[:12]
        _active_runs[run_id] = {"run_id": run_id, "status": "running", "events": [], "created_at": now}
        return run_id


def get_active(run_id: str):
    with _active_lock:
        return _active_runs.get(run_id)


def append_event(run_id: str, stage: str, data) -> None:
    with _active_lock:
        run = _active_runs.get(run_id)
        if run is None:
            return
        run["events"].append({"stage": stage, "data": data, "at": time.time()})


def get_events(run_id: str, since: int = 0) -> list[dict]:
    with _active_lock:
        run = _active_runs.get(run_id)
        return list(run["events"][since:]) if run else []


def mark_finished(run_id: str, status: str = "finished") -> None:
    with _active_lock:
        run = _active_runs.get(run_id)
        if run:
            run["status"] = status


def is_finished(run_id: str) -> bool:
    run = get_active(run_id)
    return run is None or run["status"] != "running"
