// Responsibility: Golden unit tests for the pure Leadership scorer.
// Layer: Intelligence (Layer 1) test — no DB, deterministic.
// Depends on: modules/intelligence/scoring/leadership.scorer.
// Must never be depended on by: anything (test file).

const { scoreLeadership } = require("../src/modules/intelligence/scoring/leadership.scorer");

// 8-rank ladder (Cadet .. Senior Under Officer) => totalRanks 8, indices 0..7.
const LADDER = 8;

describe("leadership.scorer", () => {
  test("no signals at all => null score, zero confidence", () => {
    const r = scoreLeadership({});
    expect(r.score).toBeNull();
    expect(r.confidence).toBe(0);
    expect(r.trend).toBe("insufficient_data");
  });

  test("top rank scores higher than bottom rank, all else equal", () => {
    const junior = scoreLeadership({ rankIndex: 0, totalRanks: LADDER });
    const suo = scoreLeadership({ rankIndex: 7, totalRanks: LADDER });
    expect(suo.score).toBeGreaterThan(junior.score);
    expect(suo.evidence.rankScore).toBe(100);
    expect(junior.evidence.rankScore).toBe(0);
  });

  test("leadership is not seniority alone — actions lift a mid-rank cadet", () => {
    const passive = scoreLeadership({ rankIndex: 3, totalRanks: LADDER });
    const active = scoreLeadership({
      rankIndex: 3,
      totalRanks: LADDER,
      responsibilityActions: 6,
      influenceCount: 40,
    });
    expect(active.score).toBeGreaterThan(passive.score);
  });

  test("responsibility saturates (a role-holder cannot run it away)", () => {
    const a = scoreLeadership({ rankIndex: 3, totalRanks: LADDER, responsibilityActions: 5 })
      .evidence.responsibility;
    const b = scoreLeadership({ rankIndex: 3, totalRanks: LADDER, responsibilityActions: 50 })
      .evidence.responsibility;
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThanOrEqual(100);
  });

  test("promotion velocity rewards faster progression and marks trend improving", () => {
    const slow = scoreLeadership({ rankIndex: 4, totalRanks: LADDER, promotions: 1, tenureYears: 4 });
    const fast = scoreLeadership({ rankIndex: 4, totalRanks: LADDER, promotions: 3, tenureYears: 2 });
    expect(fast.evidence.promotionVelocity).toBeGreaterThan(slow.evidence.promotionVelocity);
    expect(fast.trend).toBe("improving");
  });

  test("promotion component dropped when tenure unknown (no false credit)", () => {
    const r = scoreLeadership({ rankIndex: 5, totalRanks: LADDER, promotions: 2 });
    expect(r.evidence.promotionVelocity).toBeNull();
    expect(r.score).not.toBeNull();
  });

  test("a rank alone yields a real score with partial confidence", () => {
    const r = scoreLeadership({ rankIndex: 2, totalRanks: LADDER });
    expect(r.score).not.toBeNull();
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThan(1);
  });
});
