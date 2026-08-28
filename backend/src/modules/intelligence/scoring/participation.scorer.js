// Responsibility: Pure, deterministic Participation-pillar scoring for the Unit Digital Twin.
// Layer: Intelligence (Layer 1) — pure function, NO I/O, NO DB, NO Date.now side effects.
// Depends on: nothing (receives already-shaped meeting + community summaries).
// Must never be depended on by: legacy modules, or the Decision/Adjutant layers directly.
//
// Design (per SDD 2.5): PAR = 0.5*meeting_engagement + 0.5*community_activity
//   - meeting_engagement = EWMA(percentage_attended) reduced by a lateness penalty.
//   - community_activity = 100*(1 - e^(-alpha*events)) — a SATURATING curve so a
//     spammer cannot inflate the score without bound.
//   - The meeting component is dropped (weights renormalised) when the cadet had no
//     meetings, so absence of meetings never drags participation down.
//   - No signal at all => low CONFIDENCE, never a zero score (SDD 2.10 fairness rule).

const DEFAULT_HALF_LIFE_DAYS = 45;
const DEFAULT_MIN_OBSERVATIONS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const W_MEETING = 0.5;
const W_COMMUNITY = 0.5;
const COMMUNITY_ALPHA = 0.15; // ~15 contributions -> ~90/100
const LATE_PENALTY_FACTOR = 0.15; // up to -15% of meeting engagement if always late

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
 * Score a cadet's participation pillar.
 *
 * @param {{meetings?:Array<{meetingDate:(Date|string), percentageAttended:number, wasLate?:boolean}>,
 *          communityEvents?:number}} input
 * @param {{referenceDate?:(Date|string), halfLifeDays?:number, minObservations?:number, communityAlpha?:number}} [options]
 * @returns {{pillar:string, score:(number|null), confidence:number, trend:string, evidence:object, explanation:string}}
 */
function scoreParticipation(input = {}, options = {}) {
  const halfLifeDays = options.halfLifeDays ?? DEFAULT_HALF_LIFE_DAYS;
  const minObservations = options.minObservations ?? DEFAULT_MIN_OBSERVATIONS;
  const alpha = options.communityAlpha ?? COMMUNITY_ALPHA;

  const meetings = Array.isArray(input.meetings) ? input.meetings : [];
  const communityEvents = Math.max(0, Number(input.communityEvents) || 0);
  const signalVolume = meetings.length + communityEvents;

  if (signalVolume === 0) {
    return {
      pillar: "participation",
      score: null,
      confidence: 0,
      trend: "insufficient_data",
      evidence: {
        meetingsCount: 0,
        communityEvents: 0,
        averageMeetingAttendance: null,
        lateCount: 0,
      },
      explanation: "No meeting or community activity yet — participation cannot be scored.",
    };
  }

  // Reference date defaults to the latest meeting (deterministic; no Date.now()).
  const meetingDates = meetings.map((m) => toDate(m.meetingDate)).filter(Boolean);
  const referenceDate =
    toDate(options.referenceDate) ||
    (meetingDates.length
      ? new Date(Math.max(...meetingDates.map((d) => d.getTime())))
      : null);

  // Meeting engagement (recency-weighted attendance minus lateness).
  let meetingEngagement = null;
  let rawMeetingMean = null;
  let lateCount = 0;
  if (meetings.length > 0) {
    let sumW = 0;
    let sumWX = 0;
    let sumRaw = 0;
    for (const m of meetings) {
      const d = toDate(m.meetingDate);
      let ageDays = d && referenceDate ? (referenceDate.getTime() - d.getTime()) / DAY_MS : 0;
      if (ageDays < 0) ageDays = 0;
      const weight = Math.pow(0.5, ageDays / halfLifeDays);
      const pct = clamp(Number(m.percentageAttended) || 0, 0, 100);
      if (m.wasLate) lateCount += 1;
      sumW += weight;
      sumWX += weight * pct;
      sumRaw += pct;
    }
    const ewma = sumW > 0 ? sumWX / sumW : 0;
    rawMeetingMean = sumRaw / meetings.length;
    const lateRate = lateCount / meetings.length;
    meetingEngagement = clamp(ewma * (1 - LATE_PENALTY_FACTOR * lateRate), 0, 100);
  }

  // Community activity (saturating curve).
  const communityActivity = 100 * (1 - Math.exp(-alpha * communityEvents));

  // Weighted blend with renormalisation over present components.
  const parts = [{ w: W_COMMUNITY, v: communityActivity }];
  if (meetingEngagement !== null) parts.push({ w: W_MEETING, v: meetingEngagement });
  const totalWeight = parts.reduce((s, p) => s + p.w, 0);
  const score = round2(parts.reduce((s, p) => s + p.w * p.v, 0) / totalWeight);

  const confidence = round2(Math.min(1, signalVolume / minObservations));

  // Trend from recency-weighted vs flat meeting attendance (only meaningful with meetings).
  let trend = "stable";
  if (meetingEngagement !== null && rawMeetingMean !== null) {
    const delta = meetingEngagement - rawMeetingMean;
    if (delta > 3) trend = "improving";
    else if (delta < -3) trend = "declining";
  }

  const explanation =
    (meetings.length
      ? `Attended ${meetings.length} meeting(s) at ${round2(rawMeetingMean)}% avg` +
        (lateCount ? ` (${lateCount} late)` : "") +
        "; "
      : "") +
    `${communityEvents} community contribution(s). Participation ${score}/100. Trend: ${trend}.` +
    (confidence < 1 ? ` Low confidence (${signalVolume}/${minObservations} signals).` : "");

  return {
    pillar: "participation",
    score,
    confidence,
    trend,
    evidence: {
      meetingsCount: meetings.length,
      averageMeetingAttendance: rawMeetingMean === null ? null : round2(rawMeetingMean),
      meetingEngagement: meetingEngagement === null ? null : round2(meetingEngagement),
      lateCount,
      communityEvents,
      communityActivity: round2(communityActivity),
      halfLifeDays,
      minObservations,
      referenceDate: referenceDate ? referenceDate.toISOString().slice(0, 10) : null,
    },
    explanation,
  };
}

module.exports = {
  scoreParticipation,
  DEFAULT_HALF_LIFE_DAYS,
  DEFAULT_MIN_OBSERVATIONS,
  COMMUNITY_ALPHA,
};
