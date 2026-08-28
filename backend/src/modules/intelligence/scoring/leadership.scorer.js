// Responsibility: Pure, deterministic Leadership-pillar scoring for the Unit Digital Twin.
// Layer: Intelligence (Layer 1) — pure function, NO I/O, NO DB, NO Date.now side effects.
// Depends on: nothing (receives an already-shaped leadership summary).
// Must never be depended on by: legacy modules, or the Decision/Adjutant layers directly.
//
// Design (per SDD 2.6): leadership is NOT seniority alone.
//   LDR = 0.45*rankScore + 0.20*responsibility + 0.20*influence + 0.15*promotionVelocity
//   - rankScore: current rank mapped across the rank ladder (0..100).
//   - responsibility / influence: SATURATING curves on actions taken / engagement
//     received, so a role-holder cannot run the score away.
//   - promotionVelocity: promotions per year of service; dropped when tenure unknown.
//   - Junior cadets score low on leadership BY DESIGN; the Talent radar (a later
//     milestone) compensates by flagging high non-leadership pillars in juniors.
//   - No data => low CONFIDENCE, never a zero score (SDD 2.10 fairness rule).

const DEFAULT_MIN_OBSERVATIONS = 1;

const W_RANK = 0.45;
const W_RESPONSIBILITY = 0.2;
const W_INFLUENCE = 0.2;
const W_PROMOTION = 0.15;

const RESPONSIBILITY_BETA = 0.4; // ~5 actions -> ~86/100
const INFLUENCE_GAMMA = 0.05; // ~30 -> ~78/100
const PROMOTION_TARGET_PER_YEAR = 1; // 1 promotion/yr maps to full marks

function round2(n) {
  return Math.round(n * 100) / 100;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Score a cadet's leadership pillar.
 *
 * @param {{rankIndex?:number, totalRanks?:number, responsibilityActions?:number,
 *          influenceCount?:number, promotions?:number, tenureYears?:number}} input
 * @param {{minObservations?:number}} [options]
 * @returns {{pillar:string, score:(number|null), confidence:number, trend:string, evidence:object, explanation:string}}
 */
function scoreLeadership(input = {}, options = {}) {
  const minObservations = options.minObservations ?? DEFAULT_MIN_OBSERVATIONS;

  const rankIndex = input.rankIndex == null ? null : Number(input.rankIndex);
  const totalRanks = Number(input.totalRanks) || 0;
  const responsibilityActions = Math.max(0, Number(input.responsibilityActions) || 0);
  const influenceCount = Math.max(0, Number(input.influenceCount) || 0);
  const promotions = Math.max(0, Number(input.promotions) || 0);
  const tenureYears = input.tenureYears == null ? null : Number(input.tenureYears);

  const rankScore =
    rankIndex != null && totalRanks > 1
      ? clamp((100 * rankIndex) / (totalRanks - 1), 0, 100)
      : null;

  const responsibility = 100 * (1 - Math.exp(-RESPONSIBILITY_BETA * responsibilityActions));
  const influence = 100 * (1 - Math.exp(-INFLUENCE_GAMMA * influenceCount));

  let promotionVelocity = null;
  if (tenureYears != null && tenureYears > 0) {
    const perYear = promotions / tenureYears;
    promotionVelocity = clamp((100 * perYear) / PROMOTION_TARGET_PER_YEAR, 0, 100);
  }

  // If we truly know nothing (no rank, no tenure, and zero activity), decline to score.
  const anySignal =
    rankScore !== null ||
    promotionVelocity !== null ||
    responsibilityActions > 0 ||
    influenceCount > 0;
  if (!anySignal) {
    return {
      pillar: "leadership",
      score: null,
      confidence: 0,
      trend: "insufficient_data",
      evidence: { rankScore: null, responsibilityActions: 0, influenceCount: 0, promotions: 0 },
      explanation: "No rank or leadership signals available yet.",
    };
  }

  // Weighted blend with renormalisation over present components (responsibility &
  // influence are always present; rank/promotion may be dropped).
  const parts = [
    { w: W_RESPONSIBILITY, v: responsibility },
    { w: W_INFLUENCE, v: influence },
  ];
  if (rankScore !== null) parts.push({ w: W_RANK, v: rankScore });
  if (promotionVelocity !== null) parts.push({ w: W_PROMOTION, v: promotionVelocity });
  const totalWeight = parts.reduce((s, p) => s + p.w, 0);
  const score = round2(parts.reduce((s, p) => s + p.w * p.v, 0) / totalWeight);

  // Confidence grows with how much we actually know about this cadet.
  const signalCount = responsibilityActions + influenceCount + promotions;
  const confidence = round2(
    clamp(
      0.4 +
        (rankScore !== null ? 0.2 : 0) +
        (tenureYears != null && tenureYears > 0 ? 0.2 : 0) +
        Math.min(0.2, 0.05 * signalCount),
      0,
      1
    ) * Math.min(1, Math.max(signalCount, rankScore !== null ? minObservations : 0) / minObservations)
  );

  // A recent promotion reads as upward movement; otherwise stable.
  const trend = promotionVelocity !== null && promotionVelocity > 0 ? "improving" : "stable";

  const explanation =
    (rankScore !== null ? `Rank standing ${round2(rankScore)}/100; ` : "") +
    `${responsibilityActions} responsibility action(s), ${influenceCount} peer engagement(s)` +
    (promotionVelocity !== null
      ? `; ${promotions} promotion(s) over ${round2(tenureYears)}y`
      : "") +
    `. Leadership ${score}/100.` +
    (confidence < 1 ? " Confidence limited by available history." : "");

  return {
    pillar: "leadership",
    score,
    confidence,
    trend,
    evidence: {
      rankIndex,
      totalRanks,
      rankScore: rankScore === null ? null : round2(rankScore),
      responsibilityActions,
      responsibility: round2(responsibility),
      influenceCount,
      influence: round2(influence),
      promotions,
      tenureYears,
      promotionVelocity: promotionVelocity === null ? null : round2(promotionVelocity),
    },
    explanation,
  };
}

module.exports = {
  scoreLeadership,
  DEFAULT_MIN_OBSERVATIONS,
};
