// Responsibility: Golden unit tests for the pure Participation scorer.
// Layer: Intelligence (Layer 1) test — no DB, deterministic (fixed referenceDate).
// Depends on: modules/intelligence/scoring/participation.scorer.
// Must never be depended on by: anything (test file).

const { scoreParticipation } = require("../src/modules/intelligence/scoring/participation.scorer");

const REF = "2026-07-15";

function meetings(pcts, { wasLate = false } = {}) {
  const end = new Date(REF).getTime();
  return pcts.map((percentageAttended, i) => ({
    meetingDate: new Date(end - (pcts.length - 1 - i) * 7 * 86400000)
      .toISOString()
      .slice(0, 10),
    percentageAttended,
    wasLate,
  }));
}

describe("participation.scorer", () => {
  test("no signal => null score, zero confidence, insufficient_data", () => {
    const r = scoreParticipation({ meetings: [], communityEvents: 0 }, { referenceDate: REF });
    expect(r.score).toBeNull();
    expect(r.confidence).toBe(0);
    expect(r.trend).toBe("insufficient_data");
  });

  test("no meetings => scored on community only (meeting component dropped)", () => {
    const r = scoreParticipation({ meetings: [], communityEvents: 15 }, { referenceDate: REF });
    // community activity for 15 events ~= 89.5, and that is the whole score
    expect(r.evidence.meetingsCount).toBe(0);
    expect(r.score).toBeGreaterThan(85);
    expect(r.score).toBe(r.evidence.communityActivity);
  });

  test("community activity saturates (spam cannot run it away)", () => {
    const a = scoreParticipation({ communityEvents: 20 }, { referenceDate: REF }).evidence
      .communityActivity;
    const b = scoreParticipation({ communityEvents: 200 }, { referenceDate: REF }).evidence
      .communityActivity;
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThanOrEqual(100);
    expect(b - a).toBeLessThan(6); // diminishing returns
  });

  test("full meeting attendance + strong community => high score", () => {
    const r = scoreParticipation(
      { meetings: meetings([100, 100, 100]), communityEvents: 20 },
      { referenceDate: REF }
    );
    expect(r.score).toBeGreaterThan(90);
    expect(r.confidence).toBe(1);
  });

  test("lateness reduces meeting engagement", () => {
    const onTime = scoreParticipation({ meetings: meetings([100, 100, 100]) }, { referenceDate: REF });
    const late = scoreParticipation(
      { meetings: meetings([100, 100, 100], { wasLate: true }) },
      { referenceDate: REF }
    );
    expect(late.evidence.meetingEngagement).toBeLessThan(onTime.evidence.meetingEngagement);
    expect(late.evidence.lateCount).toBe(3);
  });

  test("confidence is partial below the minimum signal volume", () => {
    const r = scoreParticipation({ communityEvents: 1 }, { referenceDate: REF });
    expect(r.confidence).toBeCloseTo(0.2, 2); // 1 of 5
  });
});
