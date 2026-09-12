import { describe, expect, it } from "vitest";
import { fmtPct, fmtSeconds, fmtStamp, fmtUsd, fmtUsdCompact, fmtUsdRangeCompact, shortHash, stripMarkdown } from "@/lib/format";

describe("format helpers", () => {
  it("formats USD without decimals and with separators", () => {
    expect(fmtUsd(41839.45)).toBe("USD 41,839");
    expect(fmtUsd(null)).toBe("—");
  });
  it("formats percent with two decimals", () => {
    expect(fmtPct(4.57)).toBe("4.57%");
    expect(fmtPct(undefined)).toBe("—");
  });
  it("shortens hashes", () => {
    expect(shortHash("0x0894aa11bb22cc33dd44ee55ff66778899aabbccddeeff00112233445566778899")).toBe("0x0894aa…8899");
    expect(shortHash(null)).toBe("—");
  });
  it("renders backend timestamps", () => {
    expect(fmtStamp("20260905_021824")).toBe("2026-09-05 02:18");
    expect(fmtStamp("garbage")).toBe("garbage");
  });
  it("renders seconds with one decimal", () => {
    expect(fmtSeconds(12.34)).toBe("12.3s");
  });
  it("strips markdown emphasis and heading markers from LLM text", () => {
    expect(stripMarkdown("**【風險缺口】** 現有資安險只保 __大廠__")).toBe("【風險缺口】 現有資安險只保 大廠");
    expect(stripMarkdown("### 三大漏洞\n1. **道德風險**")).toBe("三大漏洞\n1. 道德風險");
    expect(stripMarkdown(undefined)).toBe("");
  });
});

describe("fmtUsdCompact", () => {
  it("keeps full digits below one hundred thousand", () => {
    expect(fmtUsdCompact(41839.45)).toBe("USD 41,839");
    expect(fmtUsdCompact(99999)).toBe("USD 99,999");
    expect(fmtUsdCompact(null)).toBe("—");
  });
  it("compacts thousands from one hundred thousand up", () => {
    expect(fmtUsdCompact(468000)).toBe("USD 468K");
    expect(fmtUsdCompact(123456)).toBe("USD 123.5K");
  });
  it("compacts millions with one decimal and drops a trailing .0", () => {
    expect(fmtUsdCompact(14447368)).toBe("USD 14.4M");
    expect(fmtUsdCompact(468000000)).toBe("USD 468M");
  });
  it("compacts billions", () => {
    expect(fmtUsdCompact(2500000000)).toBe("USD 2.5B");
  });
  it("rolls up to the next unit when rounding reaches 1000", () => {
    expect(fmtUsdCompact(999960000)).toBe("USD 1B");
  });
});

describe("fmtUsdRangeCompact", () => {
  it("prefixes USD once and compacts both ends", () => {
    expect(fmtUsdRangeCompact([15938710, 26564516])).toBe("USD 15.9M – 26.6M");
  });
  it("keeps small ranges as full digits", () => {
    expect(fmtUsdRangeCompact([1200, 3400])).toBe("USD 1,200 – 3,400");
  });
  it("returns a dash when the range is missing", () => {
    expect(fmtUsdRangeCompact(null)).toBe("—");
  });
});
