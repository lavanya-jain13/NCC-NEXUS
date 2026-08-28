// Responsibility: Pure, deterministic "at-risk cadet" detection over a readiness
//   snapshot. Produces explainable drivers, a severity, and a recommended action.
// Layer: Decision Support (Layer 2) — pure function, NO I/O, NO DB, NO AI (ADL-009).
// Depends on: nothing (receives a snapshot object as produced by snapshot.builder).
// Must never be depended on by: legacy modules, the Intelligence layer, or the
//   AI Adjutant directly (the Adjutant calls the decision service, not this file).
//
// Rule (per SDD 3.2): a cadet is AT RISK when >= 2 independent risk drivers fire.
//   Each driver only fires when its pillar actually has data, so a missing pillar
//   never manufactures risk. Severity escalates with driver count, and an
//   attendance+fine combination is treated as high on its own.

// Priority order for choosing the recommended action (most actionable first).
const ACTION = {
  fine: "Follow up on the pending fine and confirm payment status.",
  attendance: "Counsel the cadet on attendance and confirm their current status.",
  knowledge: "Assign focused practice quizzes on weak topics.",
  participation: "Re-engage the cadet in meetings and unit activities.",
  discipline: "Review conduct record and counsel as needed.",
  overall: "Flag for officer review of overall readiness.",
};
const ACTION_PRIORITY = ["fine", "attendance", "knowledge", "participation", "discipline", "overall"];

const LOW = {
  attendance: 60,
  discipline: 55,
  knowledge: 40,
  participation: 40,
  overall: 50,
};

function present(pillar) {
  return pillar && pillar.score != null;
}

/**
 * Assess attrition/discipline risk for one cadet from their latest snapshot.
 *
 * @param {{overall_score:(number|null), overall_confidence:(number|null),
 *          pillars?:{attendance?:object, discipline?:object, knowledge?:object,
 *                    participation?:object}}} snapshot
 * @returns {{atRisk:boolean, severity:('none'|'low'|'medium'|'high'),
 *            drivers:Array<{code:string, label:string, detail:string}>,
 *            recommendedAction:(string|null), dataConfidence:(number|null),
 *            explanation:string}}
 */
function assessRisk(snapshot) {
  const empty = {
    atRisk: false,
    severity: "none",
    drivers: [],
    recommendedAction: null,
    dataConfidence: snapshot ? snapshot.overall_confidence ?? null : null,
    explanation: "Insufficient data to assess risk.",
  };
  if (!snapshot || !snapshot.pillars) return empty;

  const { attendance, discipline, knowledge, participation } = snapshot.pillars;
  const drivers = [];

  // 1) Attendance: declining trend OR low score.
  if (present(attendance) && (attendance.trend === "declining" || attendance.score < LOW.attendance)) {
    drivers.push({
      code: "attendance",
      label: attendance.trend === "declining" ? "Attendance declining" : "Low attendance",
      detail: attendance.explanation || `Attendance score ${Math.round(attendance.score)}.`,
    });
  }

  // 2) Discipline: an outstanding fine is the sharpest signal; otherwise a low score.
  if (present(discipline)) {
    const outstanding = discipline.evidence && discipline.evidence.finesOutstanding > 0;
    if (outstanding) {
      drivers.push({
        code: "fine",
        label: "Outstanding fine(s)",
        detail: `${discipline.evidence.finesOutstanding} unpaid fine(s).`,
      });
    } else if (discipline.score < LOW.discipline) {
      drivers.push({
        code: "discipline",
        label: "Low discipline",
        detail: discipline.explanation || `Discipline score ${Math.round(discipline.score)}.`,
      });
    }
  }

  // 3) Knowledge: declining OR low.
  if (present(knowledge) && (knowledge.trend === "declining" || knowledge.score < LOW.knowledge)) {
    drivers.push({
      code: "knowledge",
      label: knowledge.trend === "declining" ? "Knowledge declining" : "Low knowledge",
      detail: knowledge.explanation || `Knowledge score ${Math.round(knowledge.score)}.`,
    });
  }

  // 4) Participation: disengaging OR low.
  if (present(participation) && (participation.trend === "declining" || participation.score < LOW.participation)) {
    drivers.push({
      code: "participation",
      label: participation.trend === "declining" ? "Disengaging" : "Low participation",
      detail: participation.explanation || `Participation score ${Math.round(participation.score)}.`,
    });
  }

  // 5) Low overall composite (a distinct aggregate signal).
  if (snapshot.overall_score != null && snapshot.overall_score < LOW.overall) {
    drivers.push({
      code: "overall",
      label: "Low overall readiness",
      detail: `Overall readiness ${Math.round(snapshot.overall_score)}.`,
    });
  }

  const codes = new Set(drivers.map((d) => d.code));
  const atRisk = drivers.length >= 2;

  let severity;
  if (drivers.length >= 3) severity = "high";
  else if (drivers.length === 2) severity = codes.has("attendance") && codes.has("fine") ? "high" : "medium";
  else if (drivers.length === 1) severity = "low";
  else severity = "none";

  const actionCode = ACTION_PRIORITY.find((c) => codes.has(c)) || null;
  const recommendedAction = actionCode ? ACTION[actionCode] : null;

  const explanation = drivers.length
    ? `${drivers.length} risk driver(s): ${drivers.map((d) => d.label).join(", ")}.`
    : "No risk drivers detected.";

  return {
    atRisk,
    severity,
    drivers,
    recommendedAction,
    dataConfidence: snapshot.overall_confidence ?? null,
    explanation,
  };
}

module.exports = { assessRisk, LOW };
