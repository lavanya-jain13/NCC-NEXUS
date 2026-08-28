// Responsibility: Pure composition of all pillar scores into a readiness-snapshot object.
// Layer: Intelligence (Layer 1) — pure function, NO I/O, NO DB.
// Depends on: the five pure scorers + the aggregator (all pure).
// Must never be depended on by: legacy modules, or the Decision/Adjutant layers.
//
// Kept separate from intelligence.service.js (which does DB I/O) so this stays
// unit-testable without a database. Discipline's unexcused-absence input is derived
// from the attendance evidence (no extra query), keeping the two pillars consistent.

const { scoreAttendance } = require("./scoring/attendance.scorer");
const { scoreKnowledge } = require("./scoring/knowledge.scorer");
const { scoreDiscipline } = require("./scoring/discipline.scorer");
const { scoreParticipation } = require("./scoring/participation.scorer");
const { scoreLeadership } = require("./scoring/leadership.scorer");
const { aggregate, GENERAL_PROFILE } = require("./scoring/aggregate");

/**
 * Build a snapshot row (not yet persisted) from a cadet's raw signals.
 *
 * @param {{
 *   regimentalNo:string, collegeId:(number|null), referenceDate?:(Date|string),
 *   attendanceObservations?:Array, quizAttempts?:Array, fines?:Array,
 *   meetings?:Array, communityEvents?:number,
 *   leadership?:{rankIndex?:number, totalRanks?:number, responsibilityActions?:number,
 *                influenceCount?:number, promotions?:number, joiningYear?:number}
 * }} input
 * @returns {{regimental_no:string, college_id:(number|null), profile:string,
 *            overall_score:(number|null), overall_confidence:number, pillars:object}}
 */
function buildSnapshot(input = {}) {
  const {
    regimentalNo,
    collegeId,
    referenceDate,
    attendanceObservations = [],
    quizAttempts = [],
    fines = [],
    meetings = [],
    communityEvents = 0,
    leadership = {},
  } = input;

  const opts = referenceDate ? { referenceDate } : {};

  // Attendance.
  const attendance = scoreAttendance(attendanceObservations, opts);

  // Knowledge (violations are filtered out inside the scorer).
  const knowledge = scoreKnowledge(quizAttempts, opts);

  // Discipline — reuses attendance evidence for unexcused absences (no extra query).
  const violations = quizAttempts
    .filter((a) => a && a.status === "failed_due_to_violation")
    .map((a) => ({ createdAt: a.createdAt }));
  const discipline = scoreDiscipline(
    {
      fines,
      violations,
      attendance: {
        unexcusedAbsences: attendance.evidence.absentCount || 0,
        scorableDrills: attendance.evidence.scorableDrills || 0,
      },
    },
    opts
  );

  // Participation.
  const participation = scoreParticipation({ meetings, communityEvents }, opts);

  // Leadership — tenure derived from the reference date (keeps the builder deterministic).
  const refDate = referenceDate ? new Date(referenceDate) : null;
  const tenureYears =
    leadership.joiningYear && refDate && !Number.isNaN(refDate.getTime())
      ? Math.max(0, refDate.getFullYear() - Number(leadership.joiningYear))
      : null;
  const leadershipPillar = scoreLeadership({
    rankIndex: leadership.rankIndex,
    totalRanks: leadership.totalRanks,
    responsibilityActions: leadership.responsibilityActions,
    influenceCount: leadership.influenceCount,
    promotions: leadership.promotions,
    tenureYears,
  });

  const pillars = {
    attendance,
    knowledge,
    discipline,
    participation,
    leadership: leadershipPillar,
  };

  const overall = aggregate(pillars, GENERAL_PROFILE);

  return {
    regimental_no: regimentalNo,
    college_id: collegeId ?? null,
    profile: "general",
    overall_score: overall.score,
    overall_confidence: overall.confidence,
    pillars,
  };
}

module.exports = { buildSnapshot };
