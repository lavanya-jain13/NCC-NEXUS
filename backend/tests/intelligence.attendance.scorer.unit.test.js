// Responsibility: Golden unit tests for the pure Attendance scorer.
// Layer: Intelligence (Layer 1) test — no DB, deterministic (fixed referenceDate).
// Depends on: modules/intelligence/scoring/attendance.scorer.
// Must never be depended on by: anything (test file).

const { scoreAttendance } = require("../src/modules/intelligence/scoring/attendance.scorer");

const REF = "2026-07-15"; // fixed reference date for deterministic weighting

// Helper: build N observations spaced 7 days apart, ending on `end`.
function series(statuses, end = REF, approvedLeaveFlags = []) {
  const endDate = new Date(end).getTime();
  return statuses.map((status, i) => {
    const daysBack = (statuses.length - 1 - i) * 7;
    return {
      drillDate: new Date(endDate - daysBack * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      status,
      approvedLeave: approvedLeaveFlags[i] === true,
    };
  });
}

describe("attendance.scorer", () => {
  test("no observations => null score, zero confidence, insufficient_data", () => {
    const r = scoreAttendance([], { referenceDate: REF });
    expect(r.score).toBeNull();
    expect(r.confidence).toBe(0);
    expect(r.trend).toBe("insufficient_data");
    expect(r.evidence.scorableDrills).toBe(0);
  });

  test("all present => score 100, full confidence when >= min drills", () => {
    const r = scoreAttendance(series(["P", "P", "P", "P", "P", "P"]), { referenceDate: REF });
    expect(r.score).toBe(100);
    expect(r.confidence).toBe(1);
    expect(r.evidence.presentCount).toBe(6);
    expect(r.evidence.absentCount).toBe(0);
  });

  test("all unexcused absent => score 0 (never null)", () => {
    const r = scoreAttendance(series(["A", "A", "A", "A", "A", "A"]), { referenceDate: REF });
    expect(r.score).toBe(0);
    expect(r.confidence).toBe(1);
  });

  test("approved leave is excused (excluded from denominator), not counted absent", () => {
    // 5 present + 1 absent-but-approved-leave => scorable=5 all present => 100
    const obs = series(
      ["P", "P", "P", "P", "P", "A"],
      REF,
      [false, false, false, false, false, true]
    );
    const r = scoreAttendance(obs, { referenceDate: REF });
    expect(r.score).toBe(100);
    expect(r.evidence.scorableDrills).toBe(5);
    expect(r.evidence.excusedLeaves).toBe(1);
  });

  test("confidence is partial when fewer than min drills", () => {
    const r = scoreAttendance(series(["P", "P"]), { referenceDate: REF });
    // 2 scorable / 5 min = 0.4
    expect(r.confidence).toBe(0.4);
    expect(r.score).toBe(100);
  });

  test("recency weighting: recent presents after old absents => improving, score > raw 50%", () => {
    // oldest 3 absent, newest 3 present
    const r = scoreAttendance(series(["A", "A", "A", "P", "P", "P"]), { referenceDate: REF });
    expect(r.evidence.rawPresentRate).toBe(0.5);
    expect(r.score).toBeGreaterThan(55);
    expect(r.trend).toBe("improving");
  });

  test("recency weighting: recent absents after old presents => declining, score < raw 50%", () => {
    const r = scoreAttendance(series(["P", "P", "P", "A", "A", "A"]), { referenceDate: REF });
    expect(r.evidence.rawPresentRate).toBe(0.5);
    expect(r.score).toBeLessThan(45);
    expect(r.trend).toBe("declining");
  });
});
