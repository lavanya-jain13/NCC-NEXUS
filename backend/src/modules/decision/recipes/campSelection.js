// Responsibility: Pure, deterministic camp/RDC selection over a cohort of readiness
//   snapshots. Ranks eligible cadets, fills a fixed number of slots (+ reserves),
//   and produces an explainable reason + caveats for every cadet — Selected,
//   Standby, or Not selected. This is the evidence a Camp Selection Board reviews.
// Layer: Decision Support (Layer 2) — pure function, NO I/O, NO DB, NO AI (ADL-009).
// Depends on: nothing (receives the cohort array produced by
//   intelligenceService.getCollegeReadiness — same shape assessCohort consumes).
// Must never be depended on by: legacy modules, the Intelligence layer, or the
//   AI Adjutant directly (the Adjutant calls the decision service, not this file).
//
// Ranking philosophy (per SDD 3.2 + the fairness rules):
//   - Rank on the snapshot's Overall Readiness (computed upstream; for a
//     profile-specific board the caller feeds profile-weighted snapshots).
//   - Deterministic tie-break: score → confidence → name → reg. no, so a re-run
//     never reshuffles equal cadets.
//   - Absence of data is NEVER treated as zero: a cadet without a snapshot is set
//     aside as "unranked" (insufficient data), never auto-rejected on a blank.
//   - Every selection is explainable and reversible — the board has final say.

const PILLAR_LABEL = {
  attendance: "Attendance",
  discipline: "Discipline",
  knowledge: "Knowledge",
  participation: "Participation",
  leadership: "Leadership",
  drill: "Drill",
  communication: "Communication",
};

// A pillar at/above this score is called out as a strength in the reason line.
const STRONG_PILLAR = 70;
// Below this data-confidence, a selection is flagged "provisional — limited data".
const LOW_CONFIDENCE = 0.5;

function present(pillar) {
  return pillar && pillar.score != null;
}

/** Top strengths (highest-scoring pillars at/above STRONG_PILLAR), most first. */
function topStrengths(pillars, limit = 2) {
  if (!pillars) return [];
  return Object.keys(pillars)
    .filter((k) => present(pillars[k]) && pillars[k].score >= STRONG_PILLAR)
    .sort((a, b) => pillars[b].score - pillars[a].score)
    .slice(0, limit)
    .map((k) => `${PILLAR_LABEL[k] || k} ${Math.round(pillars[k].score)}`);
}

/** Explainable caveats the board should weigh before confirming a selection. */
function caveatsFor(row) {
  const caveats = [];
  const pillars = row.pillars || {};

  if (row.overall_confidence != null && row.overall_confidence < LOW_CONFIDENCE) {
    caveats.push({
      code: "low_confidence",
      label: "Provisional — limited data",
      detail: `Only ${Math.round(row.overall_confidence * 100)}% data confidence; score may move as more evidence lands.`,
    });
  }

  const discipline = pillars.discipline;
  if (present(discipline) && discipline.evidence && discipline.evidence.finesOutstanding > 0) {
    caveats.push({
      code: "fine",
      label: "Outstanding fine(s)",
      detail: `${discipline.evidence.finesOutstanding} unpaid fine(s) on record — confirm cleared before the camp.`,
    });
  }

  for (const key of ["attendance", "discipline", "knowledge", "participation"]) {
    const p = pillars[key];
    if (present(p) && p.trend === "declining") {
      caveats.push({
        code: `${key}_declining`,
        label: `${PILLAR_LABEL[key]} declining`,
        detail: p.explanation || `${PILLAR_LABEL[key]} trend is declining.`,
      });
    }
  }

  return caveats;
}

// Deterministic ranking: readiness desc, then confidence desc, then name, then reg.
function compareForRank(a, b) {
  return (
    (b.overall_score ?? -1) - (a.overall_score ?? -1) ||
    (b.overall_confidence ?? -1) - (a.overall_confidence ?? -1) ||
    String(a.full_name || "").localeCompare(String(b.full_name || "")) ||
    String(a.regimental_no || "").localeCompare(String(b.regimental_no || ""))
  );
}

/**
 * Rank a cohort for a camp and split into Selected / Standby / Not selected.
 *
 * @param {Array<object>} cohort  intelligenceService.getCollegeReadiness output:
 *   { regimental_no, full_name, rank_name, has_snapshot, overall_score,
 *     overall_confidence, pillars }
 * @param {object} [opts]
 * @param {number} [opts.slots=0]        number of camp seats to fill
 * @param {number} [opts.reserves=0]     number of standby/reserve seats
 * @param {string} [opts.profile="rdc"]  provenance label for the board/report
 * @param {number|null} [opts.minReadiness=null]  hard gate: a cadet below this
 *   readiness cannot be Selected (may still be listed as reserve/not-selected)
 * @returns {{profile:string, slots:number, reserves:number,
 *   selected:Array, standby:Array, notSelected:Array, unranked:Array,
 *   summary:object}}
 */
function selectForCamp(cohort = [], opts = {}) {
  const slots = Math.max(0, Math.floor(opts.slots ?? 0));
  const reserves = Math.max(0, Math.floor(opts.reserves ?? 0));
  const profile = opts.profile || "rdc";
  const minReadiness = opts.minReadiness == null ? null : Number(opts.minReadiness);

  // Split: rankable (has a snapshot + a score) vs. unranked (insufficient data).
  const rankable = [];
  const unranked = [];
  for (const c of cohort) {
    if (c.has_snapshot && c.overall_score != null) rankable.push(c);
    else {
      unranked.push({
        regimental_no: c.regimental_no,
        full_name: c.full_name,
        rank_name: c.rank_name,
        overall_score: c.overall_score ?? null,
        overall_confidence: c.overall_confidence ?? null,
        tier: "unranked",
        reasons: ["No readiness snapshot yet — recompute before the board can rank this cadet."],
        caveats: [],
      });
    }
  }

  rankable.sort(compareForRank);

  const eligibleCount = rankable.length;
  const gate = (row) => minReadiness == null || row.overall_score >= minReadiness;

  const selected = [];
  const standby = [];
  const notSelected = [];

  rankable.forEach((row, idx) => {
    const rank = idx + 1;
    const base = {
      regimental_no: row.regimental_no,
      full_name: row.full_name,
      rank_name: row.rank_name,
      overall_score: row.overall_score,
      overall_confidence: row.overall_confidence,
      rank,
    };
    const strengths = topStrengths(row.pillars);
    const caveats = caveatsFor(row);
    const passesGate = gate(row);

    // A cadet can only take a Selected seat if within slot count AND above the gate.
    if (passesGate && selected.length < slots) {
      const reasons = [
        `Ranked #${rank} of ${eligibleCount} by readiness (${Math.round(row.overall_score)}).`,
      ];
      if (strengths.length) reasons.push(`Strengths: ${strengths.join(", ")}.`);
      selected.push({ ...base, tier: "selected", strengths, reasons, caveats });
    } else if (passesGate && standby.length < reserves) {
      const reserveRank = standby.length + 1;
      const reasons = [
        `Reserve #${reserveRank} — just below the ${slots}-seat cutoff (readiness ${Math.round(row.overall_score)}).`,
      ];
      if (strengths.length) reasons.push(`Strengths: ${strengths.join(", ")}.`);
      standby.push({ ...base, tier: "standby", strengths, reasons, caveats });
    } else {
      const reasons = [];
      if (!passesGate) {
        reasons.push(
          `Readiness ${Math.round(row.overall_score)} is below the minimum of ${minReadiness} for this camp.`
        );
      } else {
        reasons.push(
          `Readiness ${Math.round(row.overall_score)} — ranked #${rank}, outside the ${slots} seat(s)` +
            (reserves ? ` and ${reserves} reserve(s).` : ".")
        );
      }
      notSelected.push({ ...base, tier: "not_selected", strengths, reasons, caveats });
    }
  });

  const selectedScores = selected.map((s) => s.overall_score);
  const averageSelectedScore = selectedScores.length
    ? Math.round((selectedScores.reduce((a, b) => a + b, 0) / selectedScores.length) * 10) / 10
    : null;
  const cutoffScore = selected.length ? Math.round(selected[selected.length - 1].overall_score) : null;

  return {
    profile,
    slots,
    reserves,
    selected,
    standby,
    notSelected,
    unranked,
    summary: {
      cohortSize: cohort.length,
      eligibleCount,
      unrankedCount: unranked.length,
      selectedCount: selected.length,
      standbyCount: standby.length,
      notSelectedCount: notSelected.length,
      averageSelectedScore,
      cutoffScore,
      minReadiness,
    },
  };
}

module.exports = { selectForCamp, STRONG_PILLAR, LOW_CONFIDENCE };
