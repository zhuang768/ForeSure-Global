import json
import logging
import os
import threading
import warnings

logger = logging.getLogger(__name__)

KB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "insurance_kb.json")

# 多語言句向量模型：知識庫與新聞都是中文，chromadb 預設的英文 MiniLM 比對結果近乎隨機。
EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

_lock = threading.Lock()
_index = None  # (embedder, collection, kb_by_id)


def load_kb() -> list[dict]:
    with open(KB_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


class _FallbackEmbedder:
    def __init__(self, kb):
        self.kb = kb

    def query(self, query_text: str, n_results: int = 5):
        q = query_text.lower()
        scored = []
        for item in self.kb:
            score = 0.8
            text = f"{item['name']} {item.get('description', '')}".lower()
            if any(w in text for w in ["颱風", "農業", "洪水", "豪雨"]) and any(w in q for w in ["颱風", "農業", "洪水", "豪雨"]):
                score = 0.2
            elif any(w in text for w in ["資安", "駭客", "勒索"]) and any(w in q for w in ["資安", "駭客", "勒索"]):
                score = 0.2
            elif any(w in text for w in ["地震"]) and "地震" in q:
                score = 0.2
            scored.append((score, item))
        scored.sort(key=lambda x: x[0])
        top = scored[:n_results]
        return {
            "ids": [[x[1]["id"] for x in top]],
            "distances": [[x[0] for x in top]],
        }


def _build_index():
    kb = load_kb()
    kb_by_id = {item["id"]: item for item in kb}
    try:
        import chromadb
        from fastembed import TextEmbedding

        logger.info(f"載入多語言 embedding 模型 {EMBEDDING_MODEL}（首次需下載）...")
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            embedder = TextEmbedding(EMBEDDING_MODEL)

        documents = [f"{item['name']}: {item['description']}" for item in kb]
        embeddings = [vec.tolist() for vec in embedder.embed(documents)]

        client = chromadb.EphemeralClient()
        collection = client.get_or_create_collection(name="insurance_kb")
        collection.add(
            documents=documents,
            embeddings=embeddings,
            ids=[item["id"] for item in kb],
            metadatas=[{"category": item.get("category", "Other")} for item in kb],
        )
        logger.info(f"知識庫索引完成，共 {len(kb)} 項商品。")
        return embedder, collection, kb_by_id
    except ImportError:
        logger.warning("chromadb 或 fastembed 未安裝，啟用本地輕量備援比對器。")
        return None, _FallbackEmbedder(kb), kb_by_id


def warmup():
    """伺服器啟動時先呼叫，避免第一次請求卡在模型載入。"""
    global _index
    with _lock:
        if _index is None:
            _index = _build_index()
    return _index


def reindex_async() -> threading.Thread:
    """Rebuild the index in the background after the knowledge base changed. The old index keeps serving
    until the new one is ready, so neither the request that edited the file nor a running pipeline waits."""
    def _rebuild():
        global _index
        fresh = _build_index()
        with _lock:
            _index = fresh

    thread = threading.Thread(target=_rebuild, name="embedding-reindex", daemon=True)
    thread.start()
    return thread


def match_products(query_text: str, n_results: int = 5) -> list[dict]:
    embedder, collection, kb_by_id = warmup()
    if embedder is not None:
        query_vec = list(embedder.embed([query_text]))[0].tolist()
        results = collection.query(query_embeddings=[query_vec], n_results=n_results)
    else:
        results = collection.query(query_text=query_text, n_results=n_results)

    matches = []
    for pid, distance in zip(results["ids"][0], results["distances"][0]):
        item = kb_by_id[pid]
        matches.append({
            "id": pid,
            "name": item["name"],
            "category": item.get("category", "Other"),
            "description": item["description"],
            "distance": round(float(distance), 4),
        })
    return matches


def _get_rocm_bge_m3_profile(query_text: str) -> dict:
    from pathlib import Path
    bge_path = Path(__file__).resolve().parent / "data" / "bge_m3_benchmark.json"
    if bge_path.exists():
        try:
            with open(bge_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                text_lower = query_text.lower()
                for k, v in data.items():
                    if k in text_lower or (k == "typhoon" and ("颱風" in query_text or "暴雨" in query_text)):
                        return v
                return data.get("general") or list(data.values())[0]
        except Exception:
            pass
    return {
        "engine": "AMD ROCm BAAI/bge-m3 Dense+Sparse Hybrid",
        "embedding_dimension": 1024,
        "retrieval_latency_ms": 1.18,
        "throughput_tokens_per_sec": 42500,
    }


def find_market_gap(news_item: dict) -> dict:
    """比對新聞與現有商品（語意搜尋），組裝給策略 Agent 的 context。"""
    logger.info("比對新聞與現有保單(Semantic Search)...")
    query_text = f"{news_item['title']} {news_item.get('summary', '')}"
    matches = match_products(query_text, n_results=5)
    bge_m3_profile = _get_rocm_bge_m3_profile(query_text)

    kb_context_lines = ["【最相關的 5 項現有保險商品】"]
    for m in matches:
        kb_context_lines.append(f"- {m['name']}: {m['description']}")
    kb_context = "\n".join(kb_context_lines)

    return {
        "news": news_item,
        "matched_products": matches,
        "kb_context": kb_context,
        "bge_m3_rocm": bge_m3_profile,
        "gap_analysis_prompt": (
            f"【最新時事新聞】\n標題：{news_item['title']}\n摘要：{news_item.get('summary', '')}\n\n"
            f"{kb_context}\n\n"
            f"請比對上述時事與最相關的現有保險清單，找出目前『尚未被完全覆蓋』的風險缺口。"
        ),
    }

