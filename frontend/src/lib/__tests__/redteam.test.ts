import { describe, expect, it } from "vitest";
import { formatRate, isClean, outcomeKey, outcomeTone } from "@/lib/redteam";
import report from "@/lib/redteamReport.json";
import type { RedTeamReport } from "@/lib/types";

const SNAPSHOT = report as RedTeamReport;

describe("red team helpers", () => {
  it("tones detected and clean as good, misses and false positives as bad", () => {
    expect(outcomeTone("detected")).toBe("good");
    expect(outcomeTone("clean")).toBe("good");
    expect(outcomeTone("missed")).toBe("bad");
    expect(outcomeTone("false_positive")).toBe("bad");
  });

  it("tones a published known gap as muted rather than as a failure", () => {
    expect(outcomeTone("known_gap")).toBe("muted");
  });

  it("maps an outcome to its dictionary key", () => {
    expect(outcomeKey("false_positive")).toBe("redteam.outcome.false_positive");
  });

  it("formats a rate as one decimal percent and tolerates a missing one", () => {
    expect(formatRate(1)).toBe("100.0%");
    expect(formatRate(0.9231)).toBe("92.3%");
    expect(formatRate(0)).toBe("0.0%");
    expect(formatRate(null)).toBe("—");
    expect(formatRate(undefined)).toBe("—");
  });

  it("calls a report clean only when nothing was missed and nothing clean was flagged", () => {
    expect(isClean({ missed: 0, false_positives: 0 })).toBe(true);
    expect(isClean({ missed: 1, false_positives: 0 })).toBe(false);
    expect(isClean({ missed: 0, false_positives: 1 })).toBe(false);
  });
});

describe("bundled offline snapshot", () => {
  it("carries attack, control and known-gap cases with a stable hash", () => {
    expect(SNAPSHOT.attack_cases).toBeGreaterThan(0);
    expect(SNAPSHOT.control_cases).toBeGreaterThan(0);
    expect(SNAPSHOT.known_gap_cases).toBeGreaterThan(0);
    expect(SNAPSHOT.report_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(SNAPSHOT.cases).toHaveLength(SNAPSHOT.total_cases);
  });

  it("is a clean run of the checker it ships with", () => {
    expect(isClean(SNAPSHOT)).toBe(true);
    expect(SNAPSHOT.detection_rate).toBe(1);
  });
});
