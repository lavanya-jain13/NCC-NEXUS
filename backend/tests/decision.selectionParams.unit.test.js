// Responsibility: Golden unit tests for the pure camp-selection param normalizer.
// Layer: Decision Support (Layer 2) test — no DB, deterministic.
// Depends on: modules/decision/decision.service (normalizeSelectionParams).
// Must never be depended on by: anything (test file).

const { normalizeSelectionParams } = require("../src/modules/decision/decision.service");

describe("normalizeSelectionParams — valid input", () => {
  test("coerces query strings and applies defaults", () => {
    const out = normalizeSelectionParams({ slots: "5" });
    expect(out).toEqual({ slots: 5, reserves: 0, profile: "rdc", minReadiness: null });
  });

  test("accepts reserves, profile, and minReadiness", () => {
    const out = normalizeSelectionParams({
      slots: "3",
      reserves: "2",
      profile: "PROMOTION",
      minReadiness: "60",
    });
    expect(out).toEqual({ slots: 3, reserves: 2, profile: "promotion", minReadiness: 60 });
  });

  test("treats empty-string optionals as absent", () => {
    const out = normalizeSelectionParams({ slots: "4", reserves: "", minReadiness: "" });
    expect(out).toEqual({ slots: 4, reserves: 0, profile: "rdc", minReadiness: null });
  });
});

describe("normalizeSelectionParams — rejects bad input (400)", () => {
  const expect400 = (raw, re) => {
    try {
      normalizeSelectionParams(raw);
      throw new Error("expected a throw");
    } catch (e) {
      expect(e.status).toBe(400);
      if (re) expect(e.message).toMatch(re);
    }
  };

  test("missing slots", () => expect400({}, /slots/));
  test("slots below 1", () => expect400({ slots: "0" }, /slots/));
  test("non-integer slots", () => expect400({ slots: "2.5" }, /slots/));
  test("negative reserves", () => expect400({ slots: "3", reserves: "-1" }, /reserves/));
  test("unknown profile", () => expect400({ slots: "3", profile: "camp" }, /profile/));
  test("minReadiness out of range", () => expect400({ slots: "3", minReadiness: "150" }, /minReadiness/));
});
