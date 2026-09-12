import csv

from scripts.convert_nfa_stats import PERILS, convert, write_csv

XLS = "data/nfa_natural_disaster_losses_1958_2025.xls"


def test_convert_reads_first_event_from_legacy_sheet():
    rows = convert(XLS)
    first = rows[0]
    assert first["year"] == 1958
    assert first["peril"] == "typhoon"
    assert first["name"] == "溫妮"
    assert (first["month"], first["day"]) == (7, 15)
    assert first["deaths"] == 13
    assert first["households_destroyed"] == 7706
    assert first["households_half_destroyed"] == 12101


def test_convert_reads_latest_event_from_post_1994_sheet():
    rows = convert(XLS)
    last = rows[-1]
    assert last["year"] == 2025
    assert last["peril"] == "typhoon"
    assert "鳳凰" in last["name"]
    assert (last["month"], last["day"]) == (11, 10)
    assert last["deaths"] == 1
    assert last["injured"] == 60


def test_convert_skips_annual_totals_and_covers_every_year_once():
    rows = convert(XLS)
    assert len(rows) == 414
    assert all("總計" not in r["peril_raw"] for r in rows)
    years = {r["year"] for r in rows}
    assert min(years) == 1958 and max(years) == 2025
    # legacy sheet covers <= 1993, the post-1994 sheet the rest; no year is duplicated across sheets
    legacy_years = {r["year"] for r in rows if r["source_sheet"] == "總表"}
    modern_years = {r["year"] for r in rows if r["source_sheet"] != "總表"}
    assert max(legacy_years) == 1993 and min(modern_years) == 1994


def test_convert_normalises_perils():
    rows = convert(XLS)
    assert set(r["peril"] for r in rows) <= set(PERILS)
    by_raw = {}
    for r in rows:
        by_raw.setdefault(r["peril_raw"], set()).add(r["peril"])
    assert by_raw["風災"] == {"typhoon"}
    assert by_raw["山洪暴發"] == {"flood"}
    assert by_raw["地震"] == {"earthquake"}
    assert by_raw["其他"] == {"other"}


def test_write_csv_round_trips(tmp_path):
    rows = convert(XLS)
    out = tmp_path / "events.csv"
    write_csv(rows, out)
    with open(out, newline="", encoding="utf-8") as fh:
        back = list(csv.DictReader(fh))
    assert len(back) == len(rows)
    assert back[0]["name"] == "溫妮"
    assert int(back[0]["households_destroyed"]) == 7706
    assert list(back[0].keys()) == list(rows[0].keys())
