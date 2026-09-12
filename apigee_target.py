import asyncio
import json
import logging
import os
import re
import threading
import time

import jwt
import uvicorn
from fastapi import FastAPI, BackgroundTasks, Request, HTTPException, Depends
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

import product_analyzer
import run_store
from chain_writer import chain_status, verify_decision_on_chain
from main import run_pipeline
from redteam import run_redteam

KB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "insurance_kb.json")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Apigee.Target")

app = FastAPI(
    title="ForeSure Insurance GenAI Target",
    description="Backend API intended to be placed behind Google Cloud Apigee API Gateway.",
    version="1.1.0",
)

# 允許的前端來源：預設本機開發伺服器；部署到 Cloudflare Pages 時用 ATLAS_ALLOWED_ORIGINS 列出精確網址
# （逗號分隔）。不要用萬用字元，任何人都能註冊 *.pages.dev 子網域。
ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ATLAS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _warmup_embeddings():
    """伺服器啟動時在背景載入 embedding 模型，避免第一次 demo 卡 30 秒。"""
    if os.getenv("ATLAS_SKIP_WARMUP"):
        return
    from product_analyzer import warmup
    threading.Thread(target=warmup, name="embedding-warmup", daemon=True).start()


# --- 1. Rate Limiting Middleware (簡易 IP 限流) ---
# 只放行儀表板的唯讀輪詢與 SSE（GET）與 CORS 預檢；所有會觸發 LLM 或上鏈的 POST 都計數。
RATE_LIMIT = 30  # 每分鐘最多 30 次
rate_limit_records: dict[str, list[float]] = {}


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.method == "OPTIONS" or (request.method == "GET" and request.url.path.startswith("/api/v1/runs")):
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    rate_limit_records[client_ip] = [t for t in rate_limit_records.get(client_ip, []) if now - t < 60]
    if len(rate_limit_records[client_ip]) >= RATE_LIMIT:
        logger.warning(f"IP {client_ip} 觸發限流防護 (Rate Limit Exceeded)")
        return JSONResponse(status_code=429, content={"error": "Too Many Requests. Apigee quota exceeded."})
    rate_limit_records[client_ip].append(now)
    return await call_next(request)


# --- 2. JWT Authentication (企業級資安認證) ---
security = HTTPBearer()
SECRET_KEY = os.getenv("ATLAS_JWT_SECRET", "SUPER_SECRET_HACKATHON_KEY")  # 預設值僅供 Demo，正式環境由環境變數覆寫


def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        # 在實際情況下，這裡會對接 Apigee 的 JWKS 端點進行驗證
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token 已經過期 (Token Expired)")
    except jwt.InvalidTokenError:
        # 為了黑客松方便測試，允許一個萬用 Dummy Token 也能通關
        if token == "MOCK_APIGEE_TOKEN":
            return {"role": "admin"}
        raise HTTPException(status_code=401, detail="無效的 JWT Token (Invalid Token)")


class TriggerResponse(BaseModel):
    message: str
    status: str


@app.post("/api/v1/generate_insurance", response_model=TriggerResponse, dependencies=[Depends(verify_jwt)])
async def trigger_insurance_generation(background_tasks: BackgroundTasks):
    """Apigee Proxy 呼叫用：企業主管手動觸發保險發明 Agent（不串流）。"""
    logger.info("收到來自 API Gateway 的觸發請求。")
    background_tasks.add_task(run_pipeline)
    return {"message": "商品開發 Agent 已在背景啟動", "status": "processing"}


# --- 3. 儀表板用：執行、串流、歷史、驗證 ---

def _execute_run(run_id: str):
    def emit(stage, data):
        run_store.append_event(run_id, stage, data)

    try:
        run_pipeline(emit=emit)
        run_store.mark_finished(run_id, "finished")
    except Exception:
        # 細節只進伺服器日誌，不把例外文字（可能含路徑、金鑰片段）送給客戶端
        logger.exception(f"Run {run_id} 失敗")
        emit("error", "執行失敗，請查看伺服器日誌")
        run_store.mark_finished(run_id, "error")


@app.post("/api/v1/runs", dependencies=[Depends(verify_jwt)])
async def start_run(background_tasks: BackgroundTasks):
    """啟動一次完整 pipeline（需 Bearer token），回傳 run_id；用 GET /api/v1/runs/{run_id}/events 追進度。
    同一時間只允許一個執行：兩條 pipeline 並行會搶同一個 Sepolia nonce，也會同時改寫 audit_log.json。"""
    run_id = run_store.create_run_if_idle()
    if run_id is None:
        raise HTTPException(status_code=409, detail="a run is already in progress; wait for it to finish")
    background_tasks.add_task(_execute_run, run_id)
    return {"run_id": run_id, "status": "running"}


def _sse(stage: str, data) -> str:
    return f"event: {stage}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.get("/api/v1/runs/{run_id}/events")
async def stream_run_events(run_id: str):
    """Server-Sent Events：依序送出 news_fetched … chain_done, done（或 error）。"""
    if run_store.get_active(run_id) is None:
        raise HTTPException(status_code=404, detail="run not found")

    async def generator():
        sent = 0
        while True:
            events = run_store.get_events(run_id, since=sent)
            for ev in events:
                yield _sse(ev["stage"], ev["data"])
            sent += len(events)
            if any(ev["stage"] in ("done", "error") for ev in events):
                return
            if run_store.is_finished(run_id) and not run_store.get_events(run_id, since=sent):
                return
            await asyncio.sleep(0.25)

    return StreamingResponse(generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/api/v1/runs")
async def list_runs(limit: int = 50):
    """歷史執行紀錄摘要，最新在前。"""
    return [run_store.summarize(r) for r in run_store.load_runs()[:limit]]


@app.get("/api/v1/runs/{decision_id}")
async def get_run(decision_id: str):
    """單筆完整紀錄（含辯論全文、比對商品、精算、鏈上收據），供重播與驗證。"""
    record = run_store.get_run(decision_id)
    if record is not None:
        return record
    active = run_store.get_active(decision_id)
    if active is not None:
        return {"run_id": decision_id, "status": active["status"], "events": active["events"]}
    raise HTTPException(status_code=404, detail="run not found")


class VerifyRequest(BaseModel):
    tampered: dict | None = None


@app.post("/api/v1/runs/{decision_id}/verify", dependencies=[Depends(verify_jwt)])
async def verify_run(decision_id: str, body: VerifyRequest | None = None):
    """
    用儲存的 payload 重新計算雜湊並與鏈上比對（需 Bearer token）。
    傳入 tampered 可覆寫任意欄位，示範竄改後驗證不符。
    """
    record = run_store.get_run(decision_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")
    receipt = record.get("blockchain_receipt") or {}
    payload = dict(receipt.get("payload") or {})
    tampered = (body.tampered if body else None) or {}
    payload.update(tampered)

    result = verify_decision_on_chain(receipt.get("decision_id", decision_id), payload)
    if "error" in result:
        logger.error(f"鏈上驗證失敗 {decision_id}: {result['error']}")
        result["error"] = "鏈上驗證失敗，請稍後重試"
    result.update({
        "tampered_fields": sorted(tampered.keys()),
        "payload": payload,
        "stored_hash": receipt.get("data_hash"),
        "tx_hash": receipt.get("blockchain_tx_hash"),
        "verification_url": receipt.get("verification_url"),
    })
    return result


@app.get("/api/v1/chain/status")
async def get_chain_status():
    return chain_status()


@app.get("/api/v1/redteam")
async def get_redteam_report():
    """
    紅隊測試報告：用固定的對抗語料衡量幻覺檢測的檢出率與誤報率。
    純規則、不呼叫 LLM、不連外，同樣語料必得同樣結果與同一個 report_hash。
    """
    try:
        return run_redteam()
    except Exception:
        logger.exception("紅隊測試執行失敗")
        return {"error": "紅隊測試執行失敗，請查看伺服器日誌"}


# --- 4. 知識庫 ---

class KBItem(BaseModel):
    name: str
    category: str
    description: str


@app.get("/api/v1/knowledge_base")
async def get_knowledge_base():
    """讀取現有所有的保險知識庫"""
    try:
        if os.path.exists(KB_PATH):
            with open(KB_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        return []
    except Exception as e:
        logger.error(f"讀取 KB 失敗: {e}")
        return {"error": "無法讀取知識庫"}


_kb_write_lock = threading.Lock()


def _next_kb_id(kb: list[dict]) -> str:
    """Ids follow the seeded INS-001 … INS-030 pattern; the semantic index is keyed by them."""
    numbers = [int(m.group(1)) for item in kb if (m := re.fullmatch(r"INS-(\d+)", str(item.get("id", ""))))]
    return f"INS-{(max(numbers) + 1) if numbers else len(kb) + 1:03d}"


@app.post("/api/v1/knowledge_base", dependencies=[Depends(verify_jwt)])
async def add_knowledge_base(item: KBItem):
    """允許新增未來的保險商品到知識庫中（需 Bearer token）。寫入後在背景重建語意索引。"""
    try:
        with _kb_write_lock:
            kb = []
            if os.path.exists(KB_PATH):
                with open(KB_PATH, "r", encoding="utf-8") as f:
                    kb = json.load(f)
            record = {"id": _next_kb_id(kb), **item.model_dump()}
            kb.append(record)
            with open(KB_PATH, "w", encoding="utf-8") as f:
                json.dump(kb, f, ensure_ascii=False, indent=4)
        product_analyzer.reindex_async()
        return {"message": "新增成功", "item": record}
    except Exception as e:
        logger.error(f"寫入 KB 失敗: {e}")
        return {"error": "無法新增知識庫"}


# --- 5. 攤平格式的報告端點（首頁與 /generator 頁使用）---

@app.get("/api/v1/all_reports")
async def get_all_reports():
    """全部歷史報告，舊到新（前端自行 reverse）。資料來源與 /api/v1/runs 相同。"""
    return [run_store.flatten_report(r) for r in reversed(run_store.load_runs())]


@app.get("/api/v1/latest_report")
async def get_latest_report():
    """最新一份報告。"""
    runs = run_store.load_runs()
    if not runs:
        return {"error": "尚未生成任何報告"}
    return run_store.flatten_report(runs[0])


@app.post("/api/v1/run_agent", dependencies=[Depends(verify_jwt)])
async def run_agent_synchronous():
    """
    同步觸發完整 pipeline 並等待完成（約 60 到 100 秒），直接回傳攤平格式的報告。
    需要即時進度請改用 POST /api/v1/runs 加 SSE。
    """
    logger.info("前端手動觸發了 AI Agent Pipeline（同步模式）。")
    try:
        record = await run_in_threadpool(run_pipeline)
        if not record:
            return {"error": "Pipeline 執行失敗，未產生報告。"}
        return run_store.flatten_report(record)
    except Exception:
        logger.exception("執行 Agent 失敗")
        return {"error": "執行失敗，請查看伺服器日誌"}


@app.get("/api/v1/health")
async def health_check():
    return {"status": "ok", "timestamp": time.time(), "chain": chain_status()["mode"]}


if __name__ == "__main__":
    logger.info("啟動 Backend Server (Port: 8080) 等待 Apigee 連線...")
    uvicorn.run(app, host="0.0.0.0", port=8080)
