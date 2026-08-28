// Responsibility: Pure, deterministic Knowledge-pillar scoring for the Unit Digital Twin.
// Layer: Intelligence (Layer 1) — pure function, NO I/O, NO DB, NO Date.now side effects.
// Depends on: nothing (receives already-shaped quiz-attempt objects from the repository).
// Must never be depended on by: legacy modules, or the Decision/Adjutant layers
//   directly — they consume stored snapshots, not this function.
//
// Design (per SDD 2.2): KNW = 0.60*EWMA(accuracy) + 0.25*consistency + 0.15*breadth
//   - Only completed attempts count ('submitted' | 'auto_submitted').
//   - Attempts voided by proctor violations are EXCLUDED here; that signal belongs
//     to the Discipline pillar (separation of concerns).
//   - Components with insufficient data are dropped and the remaining weights are
//     renormalised, so a missing component never drags the score down.
//   - No data => low CONFIDENCE, never a zero score (SDD 2.10 fairness rule).

const DEFAULT_HALF_LIFE_DAYS = 45;
const DEFAULT_MIN_OBSERVATIONS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const W_ACCURACY = 0.6;
const W_CONSISTENCY = 0.25;
const W_BREADTH = 0.15;

const COMPLETED = new Set(["submitted", "auto_submitted"]);

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

/**
 * Score a cadet's knowledge pillar from their quiz attempts.
 *
 * @param {Array<{submittedAt:(Date|string), accuracyPercent:number, status:string, topicIds?:Array}>} attempts
 * @param {{referenceDate?:(Date|string), halfLifeDays?:number, minObservations?:number, totalTopics?:number}} [options]
 * @returns {{pillar:string, score:(number|null), confidence:number, trend:string, evidence:object, explanation:string}}
 */
function scoreKnowledge(attempts, options = {}) {
  const halfLifeDays = options.halfLifeDays ?? DEFAULT_HALF_LIFE_DAYS;
  const minObservations = options.minObservations ?? DEFAULT_MIN_OBSERVATIONS;
  const totalTopics = Number(options.totalTopics) || 0;

  const list = Array.isArray(attempts) ? attempts : [];
  const violations = list.filter((a) => a && a.status === "failed_due_to_violation");
  const scorable = list.filter(
    (a) => a && COMPLETED.has(a.status) && a.accuracyPercent != null
  );

  // Fairness rule: no completed attempts => null score + zero confidence, NOT zero.
  if (scorable.length === 0) {
    return {
      pillar: "knowledge",
      score: null,
      confidence: 0,
      trend: "insufficient_data",
      evidence: {
        totalAttempts: list.length,
        scoredAttempts: 0,
        voidedByViolation: violations.length,
        averageAccuracy: null,
        topicsCovered: 0,
        totalTopics,
      },
      explanation:
        list.length === 0
          ? "No quizzes attempted yet — knowledge cannot be scored."
          : `No completed quiz attempts yet (${violations.length} voided by proctor violation).`,
    };
  }

  // Reference date defaults to the latest attempt (deterministic; no Date.now()).
  const dates = scorable.map((a) => toDate(a.submittedAt)).filter(Boolean);
  const referenceDate =
    toDate(options.referenceDate) ||
    (dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null);

  // 1) Recency-weighted accuracy.
  let sumW = 0;
  let sumWX = 0;
  for (const a of scorable) {
    const d = toDate(a.submittedAt);
    let ageDays = d && referenceDate ? (referenceDate.getTime() - d.getTime()) / DAY_MS : 0;
    if (ageDays < 0) ageDays = 0;
    const weight = Math.pow(0.5, ageDays / halfLifeDays);
    const acc = clamp(Number(a.accuracyPercent), 0, 100);
    sumW += weight;
    sumWX += weight * acc;
  }
  const accuracyEwma = sumW > 0 ? sumWX / sumW : 0;

  const accuracies = scorable.map((a) => clamp(Number(a.accuracyPercent), 0, 100));
  const rawMean = accuracies.reduce((s, v) => s + v, 0) / accuracies.length;

  // 2) Consistency (needs >= 2 attempts, else the component is dropped).
  let consistency = null;
  if (accuracies.length >= 2) {
    const variance =
      accuracies.reduce((s, v) => s + (v - rawMean) ** 2, 0) / accuracies.length;
    consistency = clamp(100 - Math.sqrt(variance), 0, 100);
  }

  // 3) Breadth of topics covered (dropped when the topic catalogue is unknown).
  const topicSet = new Set();
  for (const a of scorable) {
    if (Array.isArray(a.topicIds)) a.topicIds.forEach((t) => t != null && topicSet.add(t));
  }
  const breadth = totalTopics > 0 ? clamp((100 * topicSet.size) / totalTopics, 0, 100) : null;

  // Weighted blend with renormalisation over the components that exist.
  const parts = [{ w: W_ACCURACY, v: accuracyEwma }];
  if (consistency !== null) parts.push({ w: W_CONSISTENCY, v: consistency });
  if (breadth !== null) parts.push({ w: W_BREADTH, v: breadth });
  const totalWeight = parts.reduce((s, p) => s + p.w, 0);
  const score = round2(parts.reduce((s, p) => s + p.w * p.v, 0) / totalWeight);

  const confidence = round2(Math.min(1, scorable.length / minObservations));

  // Trend: recency-weighted accuracy vs. flat average.
  let trend = "stable";
  const delta = accuracyEwma - rawMean;
  if (delta > 2) trend = "improving";
  else if (delta < -2) trend = "declining";

  const explanation =
    `Average accuracy ${round2(rawMean)}% across ${scorable.length} completed quiz attempt(s)` +
    (violations.length ? `, ${violations.length} voided by proctor violation` : "") +
    `. Recent attempts weighted more (half-life ${halfLifeDays}d)` +
    (consistency !== null ? `; consistency ${round2(consistency)}/100` : "") +
    (breadth !== null ? `; covered ${topicSet.size} of ${totalTopics} topics` : "") +
    `. Trend: ${trend}.` +
    (confidence < 1 ? ` Low confidence (${scorable.length}/${minObservations} attempts).` : "");

  return {
    pillar: "knowledge",
    score,
    confidence,
    trend,
    evidence: {
      totalAttempts: list.length,
      scoredAttempts: scorable.length,
      voidedByViolation: violations.length,
      averageAccuracy: round2(rawMean),
      weightedAccuracy: round2(accuracyEwma),
      consistency: consistency === null ? null : round2(consistency),
      topicsCovered: topicSet.size,
      totalTopics,
      breadth: breadth === null ? null : round2(breadth),
      halfLifeDays,
      minObservations,
      referenceDate: referenceDate ? referenceDate.toISOString().slice(0, 10) : null,
    },
    explanation,
  };
}

module.exports = {
  scoreKnowledge,
  DEFAULT_HALF_LIFE_DAYS,
  DEFAULT_MIN_OBSERVATIONS,
};
