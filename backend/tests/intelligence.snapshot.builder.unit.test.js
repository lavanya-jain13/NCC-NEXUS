// Responsibility: Golden unit tests for the pure snapshot builder (no DB).
// Layer: Intelligence (Layer 1) test.
// Depends on: modules/intelligence/snapshot.builder.
// Must never be depended on by: anything (test file).

const { buildSnapshot } = require("../src/modules/intelligence/snapshot.builder");

const REF = "2026-07-15";

function presentDrills(n) {
  const end = new Date(REF).getTime();
  return Array.from({ length: n }, (_, i) => ({
    drillDate: new Date(end - (n - 1 - i) * 7 * 86400000).toISOString().slice(0, 10),
    status: "P",
    approvedLeave: false,
  }));
}

function quizzes(n, accuracy) {
  const end = new Date(REF).getTime();
  return Array.from({ length: n }, (_, i) => ({
    submittedAt: new Date(end - (n - 1 - i) * 7 * 86400000).toISOString().slice(0, 10),
    accuracyPercent: accuracy,
    status: "submitted",
    createdAt: new Date(end - (n - 1 - i) * 7 * 86400000).toISOString().slice(0, 10),
  }));
}

const PILLAR_KEYS = ["attendance", "knowledge", "discipline", "participation", "leadership"];

describe("snapshot.builder (composite)", () => {
  test("all pillars present => composite overall score with all five pillars", () => {
    const snap = buildSnapshot({
      regimentalNo: "R1",
      collegeId: 7,
      referenceDate: REF,
      attendanceObservations: presentDrills(6),
      quizAttempts: quizzes(3, 80),
      fines: [],
      meetings: [],
      communityEvents: 10,
      leadership: {
        rankIndex: 3,
        totalRanks: 8,
        responsibilityActions: 2,
        influenceCount: 10,
        promotions: 1,
        joiningYear: 2024,
      },
    });

    expect(snap.regimental_no).toBe("R1");
    expect(snap.college_id).toBe(7);
    expect(Object.keys(snap.pillars).sort()).toEqual([...PILLAR_KEYS].sort());
    expect(typeof snap.overall_score).toBe("number");
    expect(snap.overall_score).toBeGreaterThan(0);
    expect(snap.overall_confidence).toBeGreaterThan(0);
    // Overall is a genuine blend, not just attendance (which is 100 here).
    expect(snap.overall_score).toBeLessThan(100);
  });

  test("attendance-only data => scored, but confidence below 1 (missing pillars)", () => {
    const snap = buildSnapshot({
      regimentalNo: "R2",
      collegeId: 3,
      referenceDate: REF,
      attendanceObservations: presentDrills(6),
      quizAttempts: [],
      fines: [],
      meetings: [],
      communityEvents: 0,
      leadership: {},
    });

    expect(snap.pillars.knowledge.score).toBeNull();
    expect(snap.pillars.participation.score).toBeNull();
    expect(snap.pillars.leadership.score).toBeNull();
    // Attendance (100) + discipline (clean, backed by drills) drive a real overall.
    expect(snap.overall_score).not.toBeNull();
    expect(snap.overall_confidence).toBeGreaterThan(0);
    expect(snap.overall_confidence).toBeLessThan(1);
  });

  test("no data at all => null overall score and zero confidence (fairness rule)", () => {
    const snap = buildSnapshot({
      regimentalNo: "R3",
      collegeId: null,
      referenceDate: REF,
      attendanceObservations: [],
      quizAttempts: [],
      fines: [],
      meetings: [],
      communityEvents: 0,
      leadership: {},
    });

    expect(snap.overall_score).toBeNull();
    expect(snap.overall_confidence).toBe(0);
    expect(snap.college_id).toBeNull();
    expect(snap.pillars.attendance.trend).toBe("insufficient_data");
  });

  test("an unpaid fine lowers the composite versus a clean record", () => {
    const base = {
      regimentalNo: "R4",
      collegeId: 1,
      referenceDate: REF,
      attendanceObservations: presentDrills(6),
      quizAttempts: quizzes(3, 80),
      meetings: [],
      communityEvents: 10,
      leadership: { rankIndex: 3, totalRanks: 8, joiningYear: 2024 },
    };
    const clean = buildSnapshot({ ...base, fines: [] });
    const fined = buildSnapshot({
      ...base,
      fines: [{ createdAt: REF, status: "pending" }],
    });
    expect(fined.pillars.discipline.score).toBeLessThan(clean.pillars.discipline.score);
    expect(fined.overall_score).toBeLessThan(clean.overall_score);
  });
});
