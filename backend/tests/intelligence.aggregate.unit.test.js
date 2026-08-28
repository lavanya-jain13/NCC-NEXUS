// Responsibility: Golden unit tests for the pure confidence-weighted aggregator.
// Layer: Intelligence (Layer 1) test — no DB, deterministic.
// Depends on: modules/intelligence/scoring/aggregate.
// Must never be depended on by: anything (test file).

const { aggregate, GENERAL_PROFILE } = require("../src/modules/intelligence/scoring/aggregate");

const P = (score, confidence) => ({ score, confidence });

describe("aggregate", () => {
  test("no pillars with data => null score, zero confidence", () => {
    const r = aggregate(
      { attendance: null, knowledge: P(null, 0) },
      { attendance: 0.5, knowledge: 0.5 }
    );
    expect(r.score).toBeNull();
    expect(r.confidence).toBe(0);
  });

  test("all pillars full confidence => weighted average, confidence 1", () => {
    const r = aggregate(
      { attendance: P(80, 1), knowledge: P(60, 1) },
      { attendance: 0.5, knowledge: 0.5 }
    );
    expect(r.score).toBe(70);
    expect(r.confidence).toBe(1);
  });

  test("a missing pillar sheds its weight onto pillars with data (score unaffected by the gap)", () => {
    // knowledge has no data; only attendance drives the score.
    const r = aggregate(
      { attendance: P(90, 1), knowledge: null },
      { attendance: 0.5, knowledge: 0.5 }
    );
    expect(r.score).toBe(90); // NOT dragged toward 0 by missing knowledge
    // ...but overall confidence drops because half the intended picture is absent.
    expect(r.confidence).toBe(0.5);
  });

  test("low-confidence pillar contributes less to the score than a high-confidence one", () => {
    const r = aggregate(
      { attendance: P(100, 1), knowledge: P(0, 0.2) },
      { attendance: 0.5, knowledge: 0.5 }
    );
    // Equal weights, but knowledge's 0 is down-weighted by its 0.2 confidence,
    // so the blend sits well above the naive average of 50.
    expect(r.score).toBeGreaterThan(80);
  });

  test("overall confidence reflects the share of profile weight that is backed by data", () => {
    const r = aggregate(
      { attendance: P(70, 1), discipline: P(70, 1), knowledge: P(70, 0), participation: null, leadership: null },
      GENERAL_PROFILE
    );
    // attendance(0.24) + discipline(0.20) are fully backed; the rest is absent.
    // confidence = (0.24*1 + 0.20*1) / (sum of all profile weights = 1.0) = 0.44
    expect(r.confidence).toBeCloseTo(0.44, 2);
    expect(r.score).toBe(70);
  });

  test("effective weights sum to ~1 across present pillars", () => {
    const r = aggregate(
      { attendance: P(80, 1), knowledge: P(60, 0.5) },
      { attendance: 0.5, knowledge: 0.5 }
    );
    const total = r.contributions.reduce((s, c) => s + c.effectiveWeight, 0);
    expect(total).toBeCloseTo(1, 2);
    // present flags are correct
    expect(r.contributions.find((c) => c.pillar === "attendance").present).toBe(true);
  });

  test("default GENERAL_PROFILE weights sum to 1", () => {
    const total = Object.values(GENERAL_PROFILE).reduce((s, w) => s + w, 0);
    expect(total).toBeCloseTo(1, 6);
  });
});
