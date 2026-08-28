// Responsibility: Golden unit tests for the pure Discipline scorer.
// Layer: Intelligence (Layer 1) test — no DB, deterministic (fixed referenceDate).
// Depends on: modules/intelligence/scoring/discipline.scorer.
// Must never be depended on by: anything (test file).

const { scoreDiscipline } = require("../src/modules/intelligence/scoring/discipline.scorer");

const REF = "2026-07-15";
const DAY = 86400000;

function daysBefore(n) {
  return new Date(new Date(REF).getTime() - n * DAY).toISOString().slice(0, 10);
}

const CLEAN_ATTENDANCE = { unexcusedAbsences: 0, scorableDrills: 10 };

describe("discipline.scorer", () => {
  test("clean record scores 100 (innocent by default)", () => {
    const r = scoreDiscipline({ attendance: CLEAN_ATTENDANCE }, { referenceDate: REF });
    expect(r.score).toBe(100);
    expect(r.confidence).toBe(1);
    expect(r.trend).toBe("stable");
  });

  test("a brand-new cadet with no history is not punished, only low-confidence", () => {
    const r = scoreDiscipline({}, { referenceDate: REF });
    expect(r.score).toBe(100);
    expect(r.confidence).toBe(0);
  });

  test("an outstanding fine costs more than a paid one", () => {
    const unpaid = scoreDiscipline(
      { fines: [{ createdAt: REF, status: "pending" }], attendance: CLEAN_ATTENDANCE },
      { referenceDate: REF }
    );
    const paid = scoreDiscipline(
      { fines: [{ createdAt: REF, status: "paid" }], attendance: CLEAN_ATTENDANCE },
      { referenceDate: REF }
    );
    expect(unpaid.score).toBe(88); // 100 - 12
    expect(paid.score).toBe(95); // 100 - 5
    expect(paid.score).toBeGreaterThan(unpaid.score);
  });

  test("cancelled/reversed fines carry no penalty", () => {
    const r = scoreDiscipline(
      { fines: [{ createdAt: REF, status: "cancelled" }], attendance: CLEAN_ATTENDANCE },
      { referenceDate: REF }
    );
    expect(r.score).toBe(100);
    expect(r.evidence.finesCancelled).toBe(1);
  });

  test("old infractions decay (rehabilitation)", () => {
    const recent = scoreDiscipline(
      { fines: [{ createdAt: REF, status: "pending" }], attendance: CLEAN_ATTENDANCE },
      { referenceDate: REF }
    );
    const old = scoreDiscipline(
      { fines: [{ createdAt: daysBefore(240), status: "pending" }], attendance: CLEAN_ATTENDANCE },
      { referenceDate: REF }
    );
    // 240d = 2 half-lives => penalty 12 * 0.25 = 3 => 97
    expect(old.score).toBe(97);
    expect(old.score).toBeGreaterThan(recent.score);
  });

  test("quiz proctor violations reduce discipline", () => {
    const r = scoreDiscipline(
      { violations: [{ createdAt: REF }], attendance: CLEAN_ATTENDANCE },
      { referenceDate: REF }
    );
    expect(r.score).toBe(90); // 100 - 10
    expect(r.evidence.violations).toBe(1);
  });

  test("unexcused absences scale the penalty up to the cap", () => {
    const half = scoreDiscipline(
      { attendance: { unexcusedAbsences: 5, scorableDrills: 10 } },
      { referenceDate: REF }
    );
    const all = scoreDiscipline(
      { attendance: { unexcusedAbsences: 10, scorableDrills: 10 } },
      { referenceDate: REF }
    );
    expect(half.score).toBe(90); // 20 * 0.5
    expect(all.score).toBe(80); // 20 * 1.0 (cap)
  });

  test("score floors at 0 and never goes negative", () => {
    const fines = Array.from({ length: 20 }, () => ({ createdAt: REF, status: "pending" }));
    const r = scoreDiscipline(
      { fines, attendance: { unexcusedAbsences: 10, scorableDrills: 10 } },
      { referenceDate: REF }
    );
    expect(r.score).toBe(0);
  });

  test("recent infractions after a clean past read as declining; the reverse as improving", () => {
    const declining = scoreDiscipline(
      {
        fines: [
          { createdAt: daysBefore(400), status: "paid" },
          { createdAt: REF, status: "pending" },
        ],
        attendance: CLEAN_ATTENDANCE,
      },
      { referenceDate: REF }
    );
    const improving = scoreDiscipline(
      {
        fines: [{ createdAt: daysBefore(300), status: "pending" }],
        attendance: CLEAN_ATTENDANCE,
      },
      { referenceDate: REF }
    );
    expect(declining.trend).toBe("declining");
    expect(improving.trend).toBe("improving");
  });
});
