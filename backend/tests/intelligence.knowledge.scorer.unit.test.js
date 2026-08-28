// Responsibility: Golden unit tests for the pure Knowledge scorer.
// Layer: Intelligence (Layer 1) test — no DB, deterministic (fixed referenceDate).
// Depends on: modules/intelligence/scoring/knowledge.scorer.
// Must never be depended on by: anything (test file).

const { scoreKnowledge } = require("../src/modules/intelligence/scoring/knowledge.scorer");

const REF = "2026-07-15";

// Build attempts spaced 7 days apart, ending on REF (oldest first).
function attempts(accuracies, { status = "submitted", topicIds } = {}) {
  const end = new Date(REF).getTime();
  return accuracies.map((accuracyPercent, i) => ({
    submittedAt: new Date(end - (accuracies.length - 1 - i) * 7 * 86400000)
      .toISOString()
      .slice(0, 10),
    accuracyPercent,
    status,
    topicIds,
  }));
}

describe("knowledge.scorer", () => {
  test("no attempts => null score, zero confidence, insufficient_data", () => {
    const r = scoreKnowledge([], { referenceDate: REF });
    expect(r.score).toBeNull();
    expect(r.confidence).toBe(0);
    expect(r.trend).toBe("insufficient_data");
    expect(r.evidence.scoredAttempts).toBe(0);
  });

  test("all perfect scores => 100 with full confidence", () => {
    const r = scoreKnowledge(attempts([100, 100, 100, 100]), { referenceDate: REF });
    expect(r.score).toBe(100);
    expect(r.confidence).toBe(1);
    expect(r.evidence.averageAccuracy).toBe(100);
  });

  test("proctor-violation attempts are excluded from knowledge (routed to discipline)", () => {
    const good = attempts([80, 80, 80]);
    const bad = attempts([0], { status: "failed_due_to_violation" });
    const r = scoreKnowledge([...good, ...bad], { referenceDate: REF });
    expect(r.evidence.scoredAttempts).toBe(3);
    expect(r.evidence.voidedByViolation).toBe(1);
    expect(r.evidence.averageAccuracy).toBe(80); // the 0 did NOT drag it down
  });

  test("confidence is partial below the minimum attempt count", () => {
    const r = scoreKnowledge(attempts([70]), { referenceDate: REF });
    expect(r.confidence).toBeCloseTo(0.33, 2); // 1 of 3
  });

  test("single attempt drops the consistency component (no false 'perfectly consistent')", () => {
    const r = scoreKnowledge(attempts([60]), { referenceDate: REF });
    expect(r.evidence.consistency).toBeNull();
    expect(r.score).toBe(60); // accuracy only, renormalised
  });

  test("improving accuracy over time scores above the flat average", () => {
    const r = scoreKnowledge(attempts([40, 40, 90, 90]), { referenceDate: REF });
    expect(r.evidence.averageAccuracy).toBe(65);
    expect(r.evidence.weightedAccuracy).toBeGreaterThan(65);
    expect(r.trend).toBe("improving");
  });

  test("declining accuracy is detected", () => {
    const r = scoreKnowledge(attempts([90, 90, 40, 40]), { referenceDate: REF });
    expect(r.evidence.weightedAccuracy).toBeLessThan(65);
    expect(r.trend).toBe("declining");
  });

  test("topic breadth is included when the topic catalogue is known", () => {
    const narrow = scoreKnowledge(attempts([80, 80, 80], { topicIds: ["t1"] }), {
      referenceDate: REF,
      totalTopics: 4,
    });
    expect(narrow.evidence.topicsCovered).toBe(1);
    expect(narrow.evidence.breadth).toBe(25);
    // Breadth of 25 pulls the blended score below the raw 80% accuracy.
    expect(narrow.score).toBeLessThan(80);
  });
});
