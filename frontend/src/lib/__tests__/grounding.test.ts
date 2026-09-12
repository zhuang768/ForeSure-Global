import { describe, expect, it } from "vitest";
import { flagTypeKey, groundingTone } from "@/lib/grounding";

describe("grounding helpers", () => {
  it("maps a verdict to a tone and treats missing data as none", () => {
    expect(groundingTone("pass")).toBe("pass");
    expect(groundingTone("warn")).toBe("warn");
    expect(groundingTone("fail")).toBe("fail");
    expect(groundingTone(null)).toBe("none");
    expect(groundingTone(undefined)).toBe("none");
  });
  it("maps a flag type to its dictionary key", () => {
    expect(flagTypeKey("unsupported_number")).toBe("grounding.flag.unsupported_number");
    expect(flagTypeKey("missing_disclosure")).toBe("grounding.flag.missing_disclosure");
  });
});
