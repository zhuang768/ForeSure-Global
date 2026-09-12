"""Convert the National Fire Agency (NFA) natural disaster loss workbook into a flat CSV.

Source: 內政部消防署「臺灣地區天然災害損失統計表」, https://www.nfa.gov.tw/cht/index.php?code=list&ids=233
Raw file: data/nfa_natural_disaster_losses_1958_2025.xls (one row per disaster event).

The workbook mixes two layouts:
- "總表" holds 1958-1993 in a legacy layout (year, ROC year, month, day, type, name, casualties, houses).
- "83~113年12月(消防署成立後)" holds 1994 onwards in the modern layout with English type labels and
  separate building/household counts.

Run:  python scripts/convert_nfa_stats.py   (writes data/nfa_disaster_events.csv)
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

import xlrd

LEGACY_SHEET = "總表"
MODERN_SHEET = "83~113年12月(消防署成立後)"
LEGACY_LAST_YEAR = 1993

PERILS = ("typhoon", "flood", "earthquake", "other")

FIELDS = [
    "year", "month", "day", "peril", "peril_raw", "name",
    "deaths", "missing", "injured", "households_destroyed", "households_half_destroyed",
    "source_sheet",
]

_EN_TO_PERIL = {"typhoon": "typhoon", "flood": "flood", "earthquake": "earthquake"}


def _clean(value) -> str:
    return str(value).replace("　", "").replace(" ", "").strip()


def _num(value):
    if value in ("", None):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _int(value, default=0) -> int:
    n = _num(value)
    return int(n) if n is not None else default


def normalise_peril(raw_zh: str, raw_en: str = "") -> str:
    en = _clean(raw_en).lower()
    if en in _EN_TO_PERIL:
        return _EN_TO_PERIL[en]
    zh = _clean(raw_zh)
    if "颱" in zh or zh == "風災":
        return "typhoon"
    if "水" in zh or "山洪" in zh:
        return "flood"
    if "地震" in zh:
        return "earthquake"
    return "other"


def _legacy_rows(sheet) -> list[dict]:
    rows = []
    for r in range(sheet.nrows):
        row = sheet.row_values(r)
        if _clean(row[0]) == "sum":
            continue
        year = _num(row[1])
        peril_raw = _clean(row[5])
        if year is None or year > LEGACY_LAST_YEAR or not peril_raw:
            continue
        rows.append({
            "year": int(year), "month": _int(row[3]), "day": _int(row[4]),
            "peril": normalise_peril(peril_raw), "peril_raw": peril_raw, "name": _clean(row[6]),
            "deaths": _int(row[8]), "missing": _int(row[9]), "injured": _int(row[10]),
            "households_destroyed": _int(row[12]), "households_half_destroyed": _int(row[13]),
            "source_sheet": LEGACY_SHEET,
        })
    return rows


def _modern_rows(sheet) -> list[dict]:
    rows = []
    for r in range(sheet.nrows):
        row = sheet.row_values(r)
        year = _num(row[1])
        peril_raw = _clean(row[2])
        if year is None or not peril_raw or peril_raw == "總計":
            continue
        full = _num(row[13]) if _num(row[13]) is not None else _num(row[12])   # households, else buildings
        half = _num(row[15]) if _num(row[15]) is not None else _num(row[14])
        rows.append({
            "year": int(year), "month": _int(row[5]), "day": _int(row[6]),
            "peril": normalise_peril(peril_raw, row[3]), "peril_raw": peril_raw, "name": _clean(row[4]),
            "deaths": _int(row[8]), "missing": _int(row[9]), "injured": _int(row[10]) + _int(row[11]),
            "households_destroyed": int(full or 0), "households_half_destroyed": int(half or 0),
            "source_sheet": MODERN_SHEET,
        })
    return rows


def convert(xls_path: str | Path) -> list[dict]:
    book = xlrd.open_workbook(str(xls_path))
    rows = _legacy_rows(book.sheet_by_name(LEGACY_SHEET)) + _modern_rows(book.sheet_by_name(MODERN_SHEET))
    return [{k: r[k] for k in FIELDS} for r in rows]


def write_csv(rows: list[dict], out_path: str | Path) -> None:
    with open(out_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "data" / "nfa_natural_disaster_losses_1958_2025.xls"
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else root / "data" / "nfa_disaster_events.csv"
    events = convert(src)
    write_csv(events, dst)
    print(f"wrote {len(events)} events to {dst}")
