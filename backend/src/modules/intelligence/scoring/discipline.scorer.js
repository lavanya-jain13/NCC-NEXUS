// Responsibility: Pure, deterministic Discipline-pillar scoring for the Unit Digital Twin.
// Layer: Intelligence (Layer 1) — pure function, NO I/O, NO DB, NO Date.now side effects.
// Depends on: nothing (receives already-shaped fine/violation/attendance summaries).
// Must never be depended on by: legacy modules, or the Decision/Adjutant layers
//   directly — they consume stored snapshots, not this function.
//
// Design (per SDD 2.3): higher score = better discipline.
//   DIS = clamp(100 - SUM(penalty_j * 0.5^(age_j / 120d)), 0, 100)
//   - Starts at 100: a cadet with no record is innocent by default.
//   - Penalties DECAY over time (rehabilitation) — an old infraction stops biting.
//   - Unpaid fines weigh more than paid ones: resolving a fine is rewarded.
//   - Cancelled/reversed fines carry NO penalty.
//   - Approved leave never penalises (only unexcused absences do).

const DEFAULT_HALF_LIFE_DAYS = 120;
const DEFAULT_MIN_OBSERVATIONS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const PENALTY = {
  fineUnpaid: 12, // pending / payment_submitted — still outstanding
  finePaid: 5, // resolved, but the infraction still happened
  violation: 10, // quiz proctor violation
  absenceMax: 20, // scaled by unexcused-absence rate
};

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// Cancelled fines are forgiven entirely; paid ones weigh less than outstanding ones.
function finePenalty(status) {
  const s = String(status || "").toLowerCase();
  if (s === "cancelled") return 0;
  if (s === "paid") return PENALTY.finePaid;
  return PENALTY.fineUnpaid;
}

/**
 * Score a cadet's discipline pillar.
 *
 * @param {{fines?:Array<{createdAt:(Date|string), status:string}>,
 *          violations?:Array<{createdAt:(Date|string)}>,
 *          attendance?:{unexcusedAbsences?:number, scorableDrills?:number}}} input
 * @param {{referenceDate?:(Date|string), halfLifeDays?:number, minObservations?:number}} [options]
 * @returns {{pillar:string, score:(number|null), confidence:number, trend:string, evidence:object, explanation:string}}
 */
function scoreDiscipline(input = {}, options = {}) {
  const halfLifeDays = options.halfLifeDays ?? DEFAULT_HALF_LIFE_DAYS;
  const minObservations = options.minObservations ?? DEFAULT_MIN_OBSERVATIONS;

  const fines = Array.isArray(input.fines) ? input.fines : [];
  const violations = Array.isArray(input.violations) ? input.violations : [];
  const attendance = input.attendance || {};
  const scorableDrills = Number(attendance.scorableDrills) || 0;
  const unexcusedAbsences = Number(attendance.unexcusedAbsences) || 0;

  // Reference date defaults to the most recent infraction (deterministic; no Date.now()).
  const infractionDates = [...fines, ...violations]
    .map((x) => toDate(x && x.createdAt))
    .filter(Boolean);
  const referenceDate =
    toDate(options.referenceDate) ||
    (infractionDates.length
      ? new Date(Math.max(...infractionDates.map((d) => d.getTime())))
      : null);

  const decayFor = (createdAt) => {
    const d = toDate(createdAt);
    if (!d || !referenceDate) return 1;
    let ageDays = (referenceDate.getTime() - d.getTime()) / DAY_MS;
    if (ageDays < 0) ageDays = 0;
    return Math.pow(0.5, ageDays / halfLifeDays);
  };

  let recentPenalty = 0;
  let olderPenalty = 0;
  const addPenalty = (base, createdAt) => {
    if (base <= 0) return 0;
    const decayed = base * decayFor(createdAt);
    const d = toDate(createdAt);
    const ageDays =
      d && referenceDate ? (referenceDate.getTime() - d.getTime()) / DAY_MS : 0;
    if (ageDays <= halfLifeDays) recentPenalty += decayed;
    else olderPenalty += decayed;
    return decayed;
  };

  let finePenaltyTotal = 0;
  let unpaidCount = 0;
  let paidCount = 0;
  let cancelledCount = 0;
  for (const f of fines) {
    const base = finePenalty(f && f.status);
    const s = String((f && f.status) || "").toLowerCase();
    if (s === "cancelled") cancelledCount += 1;
    else if (s === "paid") paidCount += 1;
    else unpaidCount += 1;
    finePenaltyTotal += addPenalty(base, f && f.createdAt);
  }

  let violationPenaltyTotal = 0;
  for (const v of violations) {
    violationPenaltyTotal += addPenalty(PENALTY.violation, v && v.createdAt);
  }

  // Unexcused-absence rate reflects current standing, so it is not time-decayed.
  const absenceRate = scorableDrills > 0 ? unexcusedAbsences / scorableDrills : 0;
  const absencePenalty = PENALTY.absenceMax * absenceRate;

  const totalPenalty = finePenaltyTotal + violationPenaltyTotal + absencePenalty;
  const score = round2(clamp(100 - totalPenalty, 0, 100));

  // Absence of infractions is itself a signal, so drills alone build confidence.
  const evidenceBase = scorableDrills + fines.length + violations.length;
  const confidence = round2(Math.min(1, evidenceBase / minObservations));

  let trend = "stable";
  if (recentPenalty > olderPenalty + 0.5) trend = "declining";
  else if (olderPenalty > recentPenalty + 0.5) trend = "improving";

  const bits = [];
  if (fines.length) {
    bits.push(
      `${fines.length} fine(s) (${unpaidCount} outstanding, ${paidCount} paid` +
        (cancelledCount ? `, ${cancelledCount} cancelled` : "") +
        ")"
    );
  }
  if (violations.length) bits.push(`${violations.length} quiz violation(s)`);
  if (unexcusedAbsences) bits.push(`${unexcusedAbsences} unexcused absence(s)`);

  const explanation =
    (bits.length
      ? `Record: ${bits.join(", ")}. Older infractions carry less weight (half-life ${halfLifeDays}d).`
      : "Clean record — no fines, violations or unexcused absences.") +
    ` Discipline ${score}/100. Trend: ${trend}.` +
    (confidence < 1 ? ` Low confidence (limited history).` : "");

  return {
    pillar: "discipline",
    score,
    confidence,
    trend,
    evidence: {
      finesTotal: fines.length,
      finesOutstanding: unpaidCount,
      finesPaid: paidCount,
      finesCancelled: cancelledCount,
      violations: violations.length,
      unexcusedAbsences,
      scorableDrills,
      absenceRate: round2(absenceRate),
      penaltyFromFines: round2(finePenaltyTotal),
      penaltyFromViolations: round2(violationPenaltyTotal),
      penaltyFromAbsences: round2(absencePenalty),
      totalPenalty: round2(totalPenalty),
      halfLifeDays,
      minObservations,
      referenceDate: referenceDate ? referenceDate.toISOString().slice(0, 10) : null,
    },
    explanation,
  };
}

module.exports = {
  scoreDiscipline,
  PENALTY,
  DEFAULT_HALF_LIFE_DAYS,
  DEFAULT_MIN_OBSERVATIONS,
};
