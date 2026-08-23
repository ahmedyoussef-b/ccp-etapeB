import { describe, it, expect } from "vitest";
import { computeWordScore } from "./scoring";

describe("computeWordScore", () => {
  it("returns 1.0 for exact match", () => {
    expect(computeWordScore("pompe a eau", "pompe a eau")).toBe(1.0);
  });

  it("returns 0.8 for strong substring inclusion", () => {
    expect(computeWordScore("pompe haute pression", "haute pression")).toBe(0.8);
  });

  it("returns 0 for completely different strings", () => {
    expect(computeWordScore("hello world", "bonjour tout le monde")).toBe(0);
  });

  it("computes partial word overlap correctly", () => {
    expect(computeWordScore("pompe eau presse", "pompe eau filtre")).toBeCloseTo(
      2 / 4,
      5
    );
  });

  it("returns 0 for empty strings", () => {
    expect(computeWordScore("", "")).toBe(0);
  });
});
