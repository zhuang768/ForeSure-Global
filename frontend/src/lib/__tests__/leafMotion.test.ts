import { describe, expect, it } from "vitest";
import { leafPose } from "../leafMotion";

describe("the leaf entrance and breathing motion", () => {
  it("starts above its anchor, then lands without a position jump", () => {
    expect(leafPose(0).y).toBeGreaterThan(4);
    expect(leafPose(2.4).y).toBe(0);
    expect(Math.abs(leafPose(2.399).y)).toBeLessThan(0.001);
  });

  it("stays anchored as its layers open and close on a six-second loop", () => {
    expect(leafPose(2.4).opening).toBeCloseTo(0);
    expect(leafPose(5.4).opening).toBeCloseTo(1);
    expect(leafPose(8.4).opening).toBeCloseTo(0);
    for (const time of [3, 5.4, 8.4, 42]) {
      expect(leafPose(time).x).toBe(0);
      expect(leafPose(time).y).toBe(0);
      expect(leafPose(time).yaw).toBe(leafPose(2.4).yaw);
    }
  });

  it("shows a settled, still logo with reduced motion, including on first paint", () => {
    expect(leafPose(0, true)).toEqual(leafPose(500, true));
    expect(leafPose(0, true).y).toBe(0);
    expect(leafPose(0, true).opening).toBe(0);
  });
});
