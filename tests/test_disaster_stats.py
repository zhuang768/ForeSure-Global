import pytest

import disaster_stats as ds


def _ev(year, peril, full, half=0):
    return {"year": year, "peril": peril, "households_destroyed": full, "households_half_destroyed": half}


SYNTHETIC = [
    _ev(2020, "typhoon", 10),
    _ev(2021, "typhoon", 40, 20),     # 60 households -> severe at threshold 50
    _ev(2021, "typhoon", 200),
    _ev(2022, "flood", 300),
    _ev(2023, "typhoon", 55),
    _ev(2024, "typhoon", 5),
]


def test_load_events_reads_bundled_csv_with_numeric_fields():
    events = ds.load_events()
    assert len(events) == 414
    first = events[0]
    assert first["year"] == 1958 and first["peril"] == "typhoon"
    assert isinstance(first["households_destroyed"], int)


@pytest.mark.parametrize("text,expected", [
    ("強烈颱風侵襲南台灣，農作物與漁塭大量損失", "typhoon"),
    ("Hurricane Milton makes landfall in Florida", "typhoon"),
    ("中南部豪雨成災，多處淹水", "flood"),
    ("花蓮外海規模 6.2 地震", "earthquake"),
    ("颱風帶來豪雨造成淹水", "typhoon"),   # typhoon outranks the flooding it causes
    ("勒索軟體攻擊醫院系統", None),
])
def test_classify_peril(text, expected):
    assert ds.classify_peril(text) == expected


def test_peril_statistics_on_synthetic_events():
    stats = ds.peril_statistics("typhoon", since_year=2020, severe_threshold=50, events=SYNTHETIC)
    assert stats["years_observed"] == 5                # 2020..2024, inferred from the data
    assert stats["event_count"] == 5
    assert stats["events_per_year"] == pytest.approx(1.0)
    assert stats["severe_event_count"] == 3            # 60, 200, 55
    assert stats["severe_events_per_year"] == pytest.approx(0.6)
    assert stats["annual_probability"] == pytest.approx(0.4)   # severe years: 2021, 2023
    assert stats["mean_households_per_severe_event"] == pytest.approx(105.0)
    assert stats["mean_loss_weighted_households"] == pytest.approx((50 + 200 + 55) / 3)  # half counts 0.5
    assert stats["severe_threshold"] == 50 and stats["since_year"] == 2020
    assert stats["low_sample"] is True                 # fewer than 5 severe events


def test_peril_statistics_returns_none_for_unknown_peril():
    assert ds.peril_statistics("cyber", events=SYNTHETIC) is None


def test_peril_statistics_on_real_typhoon_data_uses_recent_window():
    stats = ds.peril_statistics("typhoon")
    assert stats["since_year"] == 1995 and stats["years_observed"] == 31
    assert stats["event_count"] > 100
    assert 0.3 < stats["annual_probability"] < 0.7
    assert stats["low_sample"] is False
    assert "nfa.gov.tw" in stats["source"]
