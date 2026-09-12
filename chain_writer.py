import hashlib
import json
import logging
import os
import time
import uuid

from dotenv import load_dotenv
from web3 import Web3

logger = logging.getLogger(__name__)

_HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_HERE, "atlas-chain", ".env"))

RPC_URL = os.getenv("SEPOLIA_RPC_URL")
PRIVATE_KEY = os.getenv("DEPLOYER_PRIVATE_KEY")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")
EXPLORER_TX = "https://sepolia.etherscan.io/tx/{}"

w3 = None
account = None
contract = None
use_fallback = False


def init_web3():
    global w3, account, contract, use_fallback
    try:
        if not RPC_URL or not PRIVATE_KEY or not CONTRACT_ADDRESS:
            logger.warning("未偵測到完整的 Web3 環境變數 (atlas-chain/.env)，啟用本地模擬模式（不會產生鏈上紀錄）。")
            use_fallback = True
            return
        with open(os.path.join(_HERE, "AuditRegistryABI.json")) as f:
            artifact = json.load(f)
        abi = artifact.get("abi", artifact)
        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        account = w3.eth.account.from_key(PRIVATE_KEY)
        contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=abi)
        use_fallback = False
        logger.info(f"✅ Web3 已連線 {RPC_URL}，存證合約 {CONTRACT_ADDRESS}，寫入者 {account.address}")
    except Exception as e:
        logger.error(f"Web3 初始化失敗: {e}，啟用本地模擬模式。")
        use_fallback = True


init_web3()


def chain_status() -> dict:
    return {
        "mode": "mock" if use_fallback else "sepolia",
        "rpc_url": RPC_URL if not use_fallback else None,
        "contract_address": CONTRACT_ADDRESS if not use_fallback else None,
        "submitter": account.address if account else None,
    }


def compute_hash(decision_dict: dict) -> bytes:
    """決策 JSON 正規化後取 SHA-256，回傳 32 bytes 供合約使用。"""
    canonical = json.dumps(decision_dict, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).digest()


def record_decision_on_chain(decision_id: str, decision_dict: dict) -> dict:
    """把決策指紋寫上鏈。模擬模式不會捏造 tx hash 或區塊鏈瀏覽器連結。"""
    content_hash = compute_hash(decision_dict)

    if use_fallback:
        time.sleep(1.5)
        logger.info(f"[模擬模式] 決策 {decision_id} 指紋 {content_hash.hex()[:16]}… 未上鏈。")
        return {
            "decision_id": decision_id,
            "content_hash_hex": content_hash.hex(),
            "tx_hash": None,
            "block_number": None,
            "etherscan_url": None,
            "is_mock": True,
        }

    nonce = w3.eth.get_transaction_count(account.address)
    gas_price = w3.eth.gas_price
    txn = contract.functions.recordDecision(decision_id, content_hash).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "maxFeePerGas": int(gas_price * 2),
        "maxPriorityFeePerGas": min(int(gas_price), w3.to_wei(2, "gwei")),
    })
    signed = w3.eth.account.sign_transaction(txn, private_key=PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    tx_hex = tx_hash.hex() if tx_hash.hex().startswith("0x") else "0x" + tx_hash.hex()
    logger.info(f"等待交易上鏈... TxHash: {tx_hex}")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
    logger.info(f"✅ 決策 {decision_id} 已上鏈，區塊 {receipt.blockNumber}")
    return {
        "decision_id": decision_id,
        "content_hash_hex": content_hash.hex(),
        "tx_hash": tx_hex,
        "block_number": receipt.blockNumber,
        "etherscan_url": EXPLORER_TX.format(tx_hex),
        "is_mock": False,
    }


def verify_decision_on_chain(decision_id: str, decision_dict: dict) -> dict:
    """重新計算 hash 並與鏈上紀錄比對。"""
    content_hash = compute_hash(decision_dict)
    if use_fallback:
        return {
            "decision_id": decision_id,
            "matched": False,
            "onchain_timestamp": None,
            "submitter": None,
            "is_mock": True,
            "reason": "模擬模式，沒有鏈上紀錄可比對",
        }
    try:
        matched, timestamp, submitter = contract.functions.verifyDecision(decision_id, content_hash).call()
        return {
            "decision_id": decision_id,
            "local_hash_hex": content_hash.hex(),
            "matched": bool(matched),
            "onchain_timestamp": int(timestamp) or None,
            "submitter": submitter if int(timestamp) else None,
            "is_mock": False,
        }
    except Exception as e:
        logger.error(f"鏈上驗證失敗: {e}")
        return {"decision_id": decision_id, "matched": False, "is_mock": False, "error": str(e)}


def build_decision_payload(decision_id: str, proposal_data: dict) -> dict:
    """要被雜湊上鏈的結構化決策內容。驗證時必須用完全相同的 payload 重算。"""
    proposal = proposal_data.get("proposal", {})
    actuarial = proposal_data.get("actuarial_data", {})
    # 幻覺檢測的結論一起被雜湊：事後不能宣稱「當時檢查是過的」。舊紀錄沒有檢查，三個欄位為 None。
    grounding = proposal_data.get("grounding") or {}
    return {
        "decision_id": decision_id,
        "agent_pipeline_version": "v1.5.0",
        "trigger_news_source": proposal_data.get("source_news", "unknown_source"),
        "product_name": proposal.get("product_name", "未知險種"),
        "market_gap": proposal.get("market_gap", ""),
        "coverage_details": proposal.get("coverage_details", ""),
        "exclusions": proposal.get("exclusions", ""),
        "probability_pct": actuarial.get("probability_pct"),
        "expected_loss_usd": actuarial.get("expected_loss_usd"),
        "premium_range_usd": actuarial.get("premium_range_usd"),
        "grounding_status": grounding.get("status"),
        "grounding_flag_count": grounding.get("flag_count"),
        "grounding_checker_version": grounding.get("checker_version"),
    }


def audit_proposal_on_chain(proposal_data: dict) -> dict:
    """report_generator 呼叫的包裝：產生 decision_id、組 payload、上鏈，回傳可存進 audit_log 的收據。"""
    decision_id = f"foresure-{time.strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}"
    payload = build_decision_payload(decision_id, proposal_data)
    chain_error = None
    try:
        result = record_decision_on_chain(decision_id, payload)
    except Exception:
        # An RPC timeout or nonce clash must not lose a run that already spent LLM quota and produced a
        # report: keep the payload and hash, mark the receipt as not anchored. The exception text can carry
        # the RPC URL, so it stays in the server log and only a generic marker reaches the record.
        logger.exception(f"決策 {decision_id} 上鏈失敗，改存未存證收據")
        result = {"content_hash_hex": compute_hash(payload).hex(), "tx_hash": None, "block_number": None,
                  "etherscan_url": None, "is_mock": True}
        chain_error = "chain write failed; see server log"
    if chain_error:
        network = "上鏈失敗（未存證）"
    elif result["is_mock"]:
        network = "本地模擬（未上鏈）"
    else:
        network = "Ethereum Sepolia Testnet"
    return {
        "decision_id": decision_id,
        "payload": payload,
        "data_hash": result["content_hash_hex"],
        "blockchain_tx_hash": result["tx_hash"],
        "block_number": result["block_number"],
        "verification_url": result["etherscan_url"],
        "network": network,
        "is_mock": result["is_mock"],
        "chain_error": chain_error,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
