// Responsibility: Pure confidence-weighted aggregation of pillar scores into an
//   overall readiness score + overall confidence (SDD 2.9).
// Layer: Intelligence (Layer 1) — pure function, NO I/O, NO DB.
// Depends on: nothing (receives pillar result objects + a weight profile).
// Must never be depended on by: legacy modules, or the Decision/Adjutant layers directly.
//
// Formula (SDD 2.9):
//   Overall            = SUM(w_p * S_p * c_p) / SUM(w_p * c_p)   over pillars WITH data
//   OverallConfidence  = SUM(w_p * c_p)       / SUM(w_p)         over ALL profile pillars
//
//   - Missing / zero-confidence pillars automatically shed their weight onto the
//     pillars that DO have data (they drop out of the Overall numerator/denominator),
//     so a cadet is never dragged down by data they had no chance to generate.
//   - They DO remain in the confidence denominator, so OverallConfidence honestly
//     reflects how much of the intended picture is actually backed by data.
//   - The profile decides which pillars count; only pillars present in `weights`
//     participate (so drill/communication can be added later without capping
//     confidence before their data exists).

// Default "general readiness" profile over the pillars implemented so far.
// (Drill + communication are added to a profile once their data is collected.)
const GENERAL_PROFILE = {
  attendance: 0.24,
  discipline: 0.2,
  knowledge: 0.2,
  participation: 0.16,
  leadership: 0.2,
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

/**
 * Aggregate pillar results into an overall readiness score + confidence.
 *
 * @param {Object<string, {score:(number|null), confidence:number}|null>} pillars
 * @param {Object<string, number>} [weights] weight profile (any positive numbers; normalised internally)
 * @returns {{score:(number|null), confidence:number, weightsUsed:object, contributions:Array}}
 */
function aggregate(pillars = {}, weights = GENERAL_PROFILE) {
  const entries = Object.entries(weights).filter(([, w]) => Number(w) > 0);

  let num = 0; // SUM(w * s * c) over pillars with data
  let den = 0; // SUM(w * c)     over pillars with data
  let weightSum = 0; // SUM(w)   over all profile pillars
  let weightConf = 0; // SUM(w * c) over all profile pillars
  const contributions = [];

  for (const [key, rawW] of entries) {
    const w = Number(rawW);
    const p = pillars[key];
    const hasData = p && p.score != null && Number(p.confidence) > 0;
    const s = hasData ? Number(p.score) : null;
    const c = hasData ? Number(p.confidence) : 0;

    weightSum += w;
    weightConf += w * c;

    if (hasData) {
      num += w * s * c;
      den += w * c;
    }

    contributions.push({
      pillar: key,
      weight: w,
      score: s,
      confidence: c,
      present: hasData,
      // Share of the final Overall this pillar actually drove (0 when no data).
      effectiveWeight: 0, // filled in below once `den` is known
    });
  }

  const score = den > 0 ? round2(num / den) : null;
  const confidence = weightSum > 0 ? round3(weightConf / weightSum) : 0;

  // Backfill effective weights now that the denominator is final.
  for (const c of contributions) {
    c.effectiveWeight = den > 0 && c.present ? round3((c.weight * c.confidence) / den) : 0;
  }

  return { score, confidence, weightsUsed: { ...weights }, contributions };
}

module.exports = { aggregate, GENERAL_PROFILE };
