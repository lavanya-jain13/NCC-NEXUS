// Responsibility: Pure, deterministic Attendance-pillar scoring for the Unit Digital Twin.
// Layer: Intelligence (Layer 1) — pure function, NO I/O, NO DB, NO Date.now side effects.
// Depends on: nothing (receives already-shaped observation objects from the repository).
// Must never be depended on by: legacy modules/controllers, or the Decision/Adjutant
//   layers directly — they consume stored snapshots, not this function.
//
// Design (per SDD 2.1): recency-weighted attendance rate.
//   - Approved-leave drills are EXCLUDED (excused, never counted as absent).
//   - Recent drills weighted more via EWMA with a configurable half-life.
//   - Absence of data => low CONFIDENCE, never a zero score (SDD 2.10 fairness rule).

const DEFAULT_HALF_LIFE_DAYS = 45; // recent drills dominate; older ones fade
const DEFAULT_MIN_OBSERVATIONS = 5; // "enough" drills for full confidence
const DAY_MS = 24 * 60 * 60 * 1000;

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

/**
 * Score a cadet's attendance pillar.
 *
 * @param {Array<{drillDate:(Date|string|number), status:string, approvedLeave?:boolean}>} observations
 * @param {{referenceDate?:(Date|string|number), halfLifeDays?:number, minObservations?:number}} [options]
 * @returns {{pillar:string, score:(number|null), confidence:number, trend:string, evidence:object, explanation:string}}
 */
function scoreAttendance(observations, options = {}) {
  const halfLifeDays = options.halfLifeDays ?? DEFAULT_HALF_LIFE_DAYS;
  const minObservations = options.minObservations ?? DEFAULT_MIN_OBSERVATIONS;

  const list = Array.isArray(observations) ? observations : [];
  const total = list.length;
  const excused = list.filter((o) => o && o.approvedLeave === true);
  const scorable = list.filter((o) => o && o.approvedLeave !== true);

  // Fairness rule: no scorable data => null score + zero confidence, NOT zero.
  if (scorable.length === 0) {
    return {
      pillar: "attendance",
      score: null,
      confidence: 0,
      trend: "insufficient_data",
      evidence: {
        totalDrills: total,
        scorableDrills: 0,
        excusedLeaves: excused.length,
        presentCount: 0,
        absentCount: 0,
        rawPresentRate: null,
      },
      explanation:
        total === 0
          ? "No drills recorded yet — attendance cannot be scored."
          : `All ${total} recorded drill(s) were excused leave — no scorable attendance yet.`,
    };
  }

  // Reference date defaults to the latest scorable drill (deterministic; no Date.now()).
  const scorableDates = scorable.map((o) => toDate(o.drillDate)).filter(Boolean);
  const referenceDate =
    toDate(options.referenceDate) ||
    (scorableDates.length
      ? new Date(Math.max(...scorableDates.map((d) => d.getTime())))
      : null);

  let sumW = 0;
  let sumWX = 0;
  let presentCount = 0;

  for (const o of scorable) {
    const d = toDate(o.drillDate);
    let ageDays = d && referenceDate ? (referenceDate.getTime() - d.getTime()) / DAY_MS : 0;
    if (ageDays < 0) ageDays = 0; // guard future-dated drills
    const weight = Math.pow(0.5, ageDays / halfLifeDays);
    const x = o.status === "P" ? 1 : 0;
    if (x) presentCount += 1;
    sumW += weight;
    sumWX += weight * x;
  }

  const weightedRate = sumW > 0 ? sumWX / sumW : 0;
  const score = round2(100 * weightedRate);
  const rawRate = presentCount / scorable.length;
  const confidence = round2(Math.min(1, scorable.length / minObservations));

  // Lightweight trend: recency-weighted rate vs. simple average.
  let trend = "stable";
  const delta = weightedRate - rawRate;
  if (delta > 0.05) trend = "improving";
  else if (delta < -0.05) trend = "declining";

  const absentCount = scorable.length - presentCount;
  const explanation =
    `Present at ${presentCount} of ${scorable.length} scorable drill(s)` +
    (excused.length ? `, ${excused.length} excused leave (not counted)` : "") +
    `. Recent drills weighted more (half-life ${halfLifeDays}d). ` +
    `Weighted score ${score}, raw present rate ${round2(100 * rawRate)}%. Trend: ${trend}.` +
    (confidence < 1 ? ` Low confidence (${scorable.length}/${minObservations} drills).` : "");

  return {
    pillar: "attendance",
    score,
    confidence,
    trend,
    evidence: {
      totalDrills: total,
      scorableDrills: scorable.length,
      excusedLeaves: excused.length,
      presentCount,
      absentCount,
      rawPresentRate: round2(rawRate),
      weightedScore: score,
      halfLifeDays,
      minObservations,
      referenceDate: referenceDate ? referenceDate.toISOString().slice(0, 10) : null,
    },
    explanation,
  };
}

module.exports = {
  scoreAttendance,
  DEFAULT_HALF_LIFE_DAYS,
  DEFAULT_MIN_OBSERVATIONS,
};
