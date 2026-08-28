// Responsibility: Golden unit tests for the pure at-risk recipe.
// Layer: Decision Support (Layer 2) test — no DB, deterministic.
// Depends on: modules/decision/recipes/atRisk.
// Must never be depended on by: anything (test file).

const { assessRisk } = require("../src/modules/decision/recipes/atRisk");

// Minimal snapshot builder for tests.
function snap({ overall = 80, conf = 1, attendance, discipline, knowledge, participation } = {}) {
  const pillar = (o) =>
    o === undefined ? { score: 85, confidence: 1, trend: "stable", evidence: {} } : o;
  return {
    overall_score: overall,
    overall_confidence: conf,
    pillars: {
      attendance: pillar(attendance),
      discipline: pillar(discipline),
      knowledge: pillar(knowledge),
      participation: pillar(participation),
    },
  };
}

const P = (score, trend = "stable", evidence = {}) => ({ score, confidence: 1, trend, evidence });

describe("assessRisk", () => {
  test("null / empty snapshot => not at risk, none", () => {
    expect(assessRisk(null).atRisk).toBe(false);
    expect(assessRisk({}).severity).toBe("none");
    expect(assessRisk(null).drivers).toEqual([]);
  });

  test("a healthy cadet has no drivers", () => {
    const r = assessRisk(snap({ overall: 88 }));
    expect(r.atRisk).toBe(false);
    expect(r.severity).toBe("none");
    expect(r.drivers).toHaveLength(0);
  });

  test("a single driver flags 'low' but not at-risk", () => {
    const r = assessRisk(snap({ overall: 70, attendance: P(45) }));
    expect(r.drivers).toHaveLength(1);
    expect(r.drivers[0].code).toBe("attendance");
    expect(r.severity).toBe("low");
    expect(r.atRisk).toBe(false);
  });

  test("attendance + outstanding fine => at-risk, HIGH (critical combo)", () => {
    const r = assessRisk(
      snap({
        overall: 62,
        attendance: P(48),
        discipline: P(70, "stable", { finesOutstanding: 1 }),
      })
    );
    expect(r.atRisk).toBe(true);
    expect(r.severity).toBe("high");
    const codes = r.drivers.map((d) => d.code);
    expect(codes).toContain("attendance");
    expect(codes).toContain("fine");
    // Fine has the highest action priority.
    expect(r.recommendedAction).toMatch(/fine/i);
  });

  test("two non-critical drivers => at-risk, MEDIUM", () => {
    const r = assessRisk(
      snap({
        overall: 64,
        knowledge: P(60, "declining"),
        participation: P(60, "declining"),
      })
    );
    expect(r.atRisk).toBe(true);
    expect(r.severity).toBe("medium");
  });

  test("three drivers => HIGH", () => {
    const r = assessRisk(
      snap({
        overall: 44, // low overall is itself a driver
        attendance: P(50, "declining"),
        knowledge: P(35),
      })
    );
    expect(r.drivers.length).toBeGreaterThanOrEqual(3);
    expect(r.severity).toBe("high");
    expect(r.atRisk).toBe(true);
  });

  test("a missing pillar never manufactures a driver", () => {
    const s = snap({ overall: 80 });
    s.pillars.knowledge = { score: null, confidence: 0, trend: "insufficient_data", evidence: {} };
    const r = assessRisk(s);
    expect(r.drivers.find((d) => d.code === "knowledge")).toBeUndefined();
  });

  test("an outstanding fine takes precedence over a low-discipline driver (no double count)", () => {
    const r = assessRisk(
      snap({ overall: 70, discipline: P(40, "stable", { finesOutstanding: 2 }) })
    );
    const codes = r.drivers.map((d) => d.code);
    expect(codes).toContain("fine");
    expect(codes).not.toContain("discipline");
  });
});
