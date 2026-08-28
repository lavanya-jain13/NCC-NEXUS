// Responsibility: Golden unit tests for the pure cohort assessment + flag reconcile.
// Layer: Decision Support (Layer 2) test — no DB, deterministic.
// Depends on: modules/decision/decision.service (assessCohort, reconcilePlan).
// Must never be depended on by: anything (test file).

const { assessCohort, reconcilePlan } = require("../src/modules/decision/decision.service");

const P = (score, trend = "stable", evidence = {}) => ({ score, confidence: 1, trend, evidence });

function cohortRow({ reg, name = "Cadet", overall = 80, snapshot = true, attendance, discipline, knowledge, participation }) {
  const d = (o) => (o === undefined ? P(85) : o);
  return {
    regimental_no: reg,
    full_name: name,
    rank_name: "Cadet",
    has_snapshot: snapshot,
    overall_score: overall,
    overall_confidence: 1,
    pillars: {
      attendance: d(attendance),
      discipline: d(discipline),
      knowledge: d(knowledge),
      participation: d(participation),
    },
  };
}

describe("assessCohort", () => {
  test("returns only at-risk cadets, sorted by severity (high first)", () => {
    const cohort = [
      cohortRow({ reg: "HEALTHY", overall: 88 }),
      cohortRow({ reg: "MEDIUM", overall: 64, knowledge: P(60, "declining"), participation: P(60, "declining") }),
      cohortRow({ reg: "HIGH", overall: 44, attendance: P(48, "declining"), discipline: P(70, "stable", { finesOutstanding: 1 }) }),
    ];
    const risk = assessCohort(cohort);
    expect(risk.map((r) => r.regimental_no)).toEqual(["HIGH", "MEDIUM"]);
    expect(risk[0].severity).toBe("high");
    expect(risk[1].severity).toBe("medium");
  });

  test("cadets without a snapshot are skipped", () => {
    const cohort = [
      cohortRow({ reg: "NOSNAP", snapshot: false, overall: 10 }),
      cohortRow({ reg: "OK", overall: 90 }),
    ];
    expect(assessCohort(cohort)).toEqual([]);
  });
});

describe("reconcilePlan", () => {
  const risk = (reg) => ({ regimental_no: reg, severity: "high", drivers: [], recommendedAction: "x", explanation: "y", dataConfidence: 0.9 });

  test("new at-risk cadet => insert; existing => update; recovered => resolve", () => {
    const atRisk = [risk("A"), risk("B")];
    const activeFlags = [
      { id: 10, regimental_no: "B" }, // still at risk -> update
      { id: 11, regimental_no: "C" }, // no longer at risk -> resolve
    ];
    const plan = reconcilePlan(atRisk, activeFlags);
    expect(plan.toInsert.map((a) => a.regimental_no)).toEqual(["A"]);
    expect(plan.toUpdate.map((u) => ({ id: u.id, reg: u.risk.regimental_no }))).toEqual([
      { id: 10, reg: "B" },
    ]);
    expect(plan.toResolve.map((f) => f.id)).toEqual([11]);
  });

  test("empty inputs => empty plan", () => {
    const plan = reconcilePlan([], []);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toResolve).toEqual([]);
  });
});
