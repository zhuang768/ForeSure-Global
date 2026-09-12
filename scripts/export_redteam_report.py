"""把紅隊報告輸出成前端離線 demo 用的快照。

攤位 demo 不一定連得到後端，前端在離線時會讀 `frontend/src/lib/redteamReport.json`。
改過語料或檢查器之後執行本腳本重新產生，`tests/test_redteam.py` 會擋下沒同步的快照。

    python scripts/export_redteam_report.py
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from redteam import run_redteam  # noqa: E402

OUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "src", "lib", "redteamReport.json"
)


def main() -> int:
    report = run_redteam()
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"寫入 {OUT_PATH}（報告雜湊 {report['report_hash']}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
