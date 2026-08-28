// Responsibility: Golden unit tests for the pure cohort merge (no DB).
// Layer: Intelligence (Layer 1) test.
// Depends on: modules/intelligence/intelligence.service (mergeCohort export).
// Must never be depended on by: anything (test file).

const { mergeCohort } = require("../src/modules/intelligence/intelligence.service");

describe("mergeCohort", () => {
  test("cadets with and without snapshots are all returned, correctly flagged", () => {
    const cadets = [
      { regimentalNo: "R1", fullName: "Alpha", rankName: "Cadet" },
      { regimentalNo: "R2", fullName: "Bravo", rankName: "Senior Under Officer" },
    ];
    const snapshots = [
      {
        regimental_no: "R1",
        overall_score: 82.5,
        overall_confidence: 0.9,
        computed_at: "2026-07-15T00:00:00Z",
        pillars: { attendance: { score: 90 } },
      },
    ];

    const rows = mergeCohort(cadets, snapshots);
    expect(rows).toHaveLength(2);

    const r1 = rows.find((r) => r.regimental_no === "R1");
    expect(r1.has_snapshot).toBe(true);
    expect(r1.overall_score).toBe(82.5);
    expect(r1.full_name).toBe("Alpha");
    expect(r1.pillars).toEqual({ attendance: { score: 90 } });

    const r2 = rows.find((r) => r.regimental_no === "R2");
    expect(r2.has_snapshot).toBe(false);
    expect(r2.overall_score).toBeNull();
    expect(r2.overall_confidence).toBeNull();
    expect(r2.rank_name).toBe("Senior Under Officer");
  });

  test("empty / missing inputs yield an empty array (no throw)", () => {
    expect(mergeCohort([], [])).toEqual([]);
    expect(mergeCohort()).toEqual([]);
  });
});
