// Responsibility: Golden unit tests for the pure camp/RDC selection recipe.
// Layer: Decision Support (Layer 2) test — no DB, deterministic.
// Depends on: modules/decision/recipes/campSelection (selectForCamp).
// Must never be depended on by: anything (test file).

const { selectForCamp } = require("../src/modules/decision/recipes/campSelection");

// Pillar helper: score + optional trend/evidence.
const P = (score, trend = "stable", evidence = {}) => ({ score, confidence: 1, trend, evidence });

function row({
  reg,
  name = "Cadet " + reg,
  overall = 80,
  conf = 1,
  snapshot = true,
  pillars,
}) {
  return {
    regimental_no: reg,
    full_name: name,
    rank_name: "Cadet",
    has_snapshot: snapshot,
    overall_score: snapshot ? overall : null,
    overall_confidence: snapshot ? conf : null,
    pillars: pillars || {
      attendance: P(85),
      discipline: P(80),
      knowledge: P(75),
      participation: P(72),
    },
  };
}

describe("selectForCamp — ranking & tiers", () => {
  const cohort = [
    row({ reg: "A", overall: 90 }),
    row({ reg: "B", overall: 82 }),
    row({ reg: "C", overall: 76 }),
    row({ reg: "D", overall: 64 }),
    row({ reg: "E", overall: 55 }),
  ];

  test("fills slots with the top-scoring cadets in order", () => {
    const res = selectForCamp(cohort, { slots: 2 });
    expect(res.selected.map((s) => s.regimental_no)).toEqual(["A", "B"]);
    expect(res.selected[0].rank).toBe(1);
    expect(res.selected[1].rank).toBe(2);
    expect(res.summary.cutoffScore).toBe(82);
    expect(res.summary.averageSelectedScore).toBe(86);
  });

  test("reserves become standby; the rest are not selected", () => {
    const res = selectForCamp(cohort, { slots: 2, reserves: 1 });
    expect(res.selected.map((s) => s.regimental_no)).toEqual(["A", "B"]);
    expect(res.standby.map((s) => s.regimental_no)).toEqual(["C"]);
    expect(res.notSelected.map((s) => s.regimental_no)).toEqual(["D", "E"]);
    expect(res.standby[0].tier).toBe("standby");
  });

  test("slots larger than the cohort selects everyone eligible", () => {
    const res = selectForCamp(cohort, { slots: 99 });
    expect(res.selected).toHaveLength(5);
    expect(res.notSelected).toHaveLength(0);
  });
});

describe("selectForCamp — data fairness", () => {
  test("cadets without a snapshot are set aside as unranked, never auto-selected", () => {
    const cohort = [
      row({ reg: "A", overall: 90 }),
      row({ reg: "NOSNAP", snapshot: false }),
    ];
    const res = selectForCamp(cohort, { slots: 5 });
    expect(res.selected.map((s) => s.regimental_no)).toEqual(["A"]);
    expect(res.unranked.map((s) => s.regimental_no)).toEqual(["NOSNAP"]);
    expect(res.unranked[0].tier).toBe("unranked");
    expect(res.summary.unrankedCount).toBe(1);
    expect(res.summary.eligibleCount).toBe(1);
  });
});

describe("selectForCamp — minReadiness gate", () => {
  test("a cadet below the minimum cannot take a selected seat", () => {
    const cohort = [
      row({ reg: "A", overall: 88 }),
      row({ reg: "LOW", overall: 40 }),
    ];
    const res = selectForCamp(cohort, { slots: 5, minReadiness: 60 });
    expect(res.selected.map((s) => s.regimental_no)).toEqual(["A"]);
    expect(res.notSelected.map((s) => s.regimental_no)).toEqual(["LOW"]);
    expect(res.notSelected[0].reasons[0]).toMatch(/below the minimum of 60/);
  });
});

describe("selectForCamp — explainability & caveats", () => {
  test("selected cadet carries rank reason + pillar strengths", () => {
    const cohort = [row({ reg: "A", overall: 90 })];
    const res = selectForCamp(cohort, { slots: 1 });
    const pick = res.selected[0];
    expect(pick.reasons[0]).toMatch(/Ranked #1 of 1/);
    expect(pick.strengths.length).toBeGreaterThan(0);
    expect(pick.strengths.join(",")).toMatch(/Attendance 85/);
  });

  test("low confidence flags a provisional caveat but stays selectable", () => {
    const cohort = [row({ reg: "THIN", overall: 92, conf: 0.3 })];
    const res = selectForCamp(cohort, { slots: 1 });
    expect(res.selected.map((s) => s.regimental_no)).toEqual(["THIN"]);
    expect(res.selected[0].caveats.map((c) => c.code)).toContain("low_confidence");
  });

  test("an outstanding fine is surfaced as a caveat on the selected cadet", () => {
    const cohort = [
      row({
        reg: "FINE",
        overall: 85,
        pillars: {
          attendance: P(80),
          discipline: P(78, "stable", { finesOutstanding: 2 }),
          knowledge: P(75),
          participation: P(70),
        },
      }),
    ];
    const res = selectForCamp(cohort, { slots: 1 });
    expect(res.selected[0].caveats.map((c) => c.code)).toContain("fine");
  });
});

describe("selectForCamp — determinism", () => {
  test("equal scores break by confidence, then name — stable across runs", () => {
    const cohort = [
      row({ reg: "R2", name: "Bravo", overall: 80, conf: 0.9 }),
      row({ reg: "R1", name: "Alpha", overall: 80, conf: 0.9 }),
      row({ reg: "R3", name: "Charlie", overall: 80, conf: 0.7 }),
    ];
    const a = selectForCamp(cohort, { slots: 3 });
    const b = selectForCamp([...cohort].reverse(), { slots: 3 });
    // Alpha & Bravo tie on score+conf → name breaks it; Charlie last on lower conf.
    expect(a.selected.map((s) => s.regimental_no)).toEqual(["R1", "R2", "R3"]);
    expect(b.selected.map((s) => s.regimental_no)).toEqual(a.selected.map((s) => s.regimental_no));
  });
});
