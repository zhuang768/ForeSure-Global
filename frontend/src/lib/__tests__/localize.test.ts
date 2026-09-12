import { describe, expect, it } from "vitest";
import { localizedField, localizedSource } from "@/lib/localize";
import type { ActuarialBasis, Proposal } from "@/lib/types";

const bilingual: Proposal = {
  product_name: "都會流域智慧防汛車隊保險",
  product_name_en: "Urban Flood Fleet Insurance",
  target_audience: "物流車隊",
  target_audience_en: "Logistics fleets",
  market_gap: "缺口",
  market_gap_en: "Gap",
  coverage_details: "保障",
  coverage_details_en: "Coverage",
  exclusions: "除外",
  exclusions_en: "Exclusions",
  business_logic: "商業邏輯",
  business_logic_en: "Business logic",
};

const legacy: Proposal = {
  product_name: "舊紀錄商品",
  target_audience: "舊客群",
  market_gap: "舊缺口",
  coverage_details: "舊保障",
  exclusions: "舊除外",
  business_logic: "舊邏輯",
};

describe("localizedField", () => {
  it("returns the Chinese field for zh", () => {
    expect(localizedField(bilingual, "product_name", "zh")).toBe("都會流域智慧防汛車隊保險");
  });
  it("returns the English twin for en when present", () => {
    expect(localizedField(bilingual, "product_name", "en")).toBe("Urban Flood Fleet Insurance");
    expect(localizedField(bilingual, "business_logic", "en")).toBe("Business logic");
  });
  it("falls back to Chinese for en when the record predates the English twin", () => {
    expect(localizedField(legacy, "market_gap", "en")).toBe("舊缺口");
  });
  it("treats an empty English twin as missing", () => {
    expect(localizedField({ ...bilingual, exclusions_en: "   " }, "exclusions", "en")).toBe("除外");
  });
  it("returns an empty string when there is no proposal", () => {
    expect(localizedField(null, "product_name", "en")).toBe("");
  });
});

describe("localizedSource", () => {
  const nfa: ActuarialBasis = {
    probability_source: "內政部消防署 臺灣地區天然災害損失統計表 1958-2025",
    probability_source_en: "National Fire Agency, Ministry of the Interior: Natural Disaster Loss Statistics for Taiwan 1958-2025",
  };
  it("returns the English source name for en", () => {
    expect(localizedSource(nfa, "en")).toBe(
      "National Fire Agency, Ministry of the Interior: Natural Disaster Loss Statistics for Taiwan 1958-2025",
    );
  });
  it("keeps the Chinese source for zh", () => {
    expect(localizedSource(nfa, "zh")).toBe("內政部消防署 臺灣地區天然災害損失統計表 1958-2025");
  });
  it("leaves the assumption sentinel untouched in both languages", () => {
    expect(localizedSource({ probability_source: "assumption" }, "en")).toBe("assumption");
  });
  it("falls back to Chinese when no English name exists", () => {
    expect(localizedSource({ probability_source: "某來源" }, "en")).toBe("某來源");
    expect(localizedSource(null, "en")).toBeUndefined();
  });
});
