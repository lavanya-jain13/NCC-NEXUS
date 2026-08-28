// Responsibility: Read/write access for the NEW `readiness_snapshots` table.
// Layer: Intelligence (Layer 1) — data access for the NEW table only.
// Depends on: db/knex and the new `readiness_snapshots` table.
// Must never be depended on by: any existing/legacy module.
// NOTE: Unlike intelligence.repository.js (SELECT-only over LEGACY tables), this
//   file MAY INSERT — but ONLY into the new readiness_snapshots table. It never
//   writes to any existing/legacy table.

const db = require("../../db/knex");

const TABLE = "readiness_snapshots";

function normalize(row) {
  if (!row) return null;
  return {
    ...row,
    overall_score: row.overall_score == null ? null : Number(row.overall_score),
    overall_confidence: row.overall_confidence == null ? null : Number(row.overall_confidence),
    pillars: typeof row.pillars === "string" ? JSON.parse(row.pillars) : row.pillars,
  };
}

/**
 * Persist a new snapshot row and return it (normalized).
 * @param {object} snapshot output of snapshot.builder.buildSnapshot
 */
async function insertSnapshot(snapshot) {
  const [row] = await db(TABLE)
    .insert({
      regimental_no: snapshot.regimental_no,
      college_id: snapshot.college_id ?? null,
      profile: snapshot.profile || "general",
      overall_score: snapshot.overall_score,
      overall_confidence: snapshot.overall_confidence,
      pillars: JSON.stringify(snapshot.pillars),
    })
    .returning("*");
  return normalize(row);
}

/**
 * Return the most recent snapshot for a cadet under a profile, or null.
 * @param {string} regimentalNo
 * @param {string} [profile="general"]
 */
async function getLatestByCadet(regimentalNo, profile = "general") {
  const row = await db(TABLE)
    .where({ regimental_no: regimentalNo, profile })
    .orderBy("computed_at", "desc")
    .first();
  return normalize(row);
}

/**
 * Return the LATEST snapshot per cadet for a whole college (one row per cadet).
 * Uses Postgres DISTINCT ON (regimental_no) with computed_at DESC.
 * @param {number} collegeId
 * @param {string} [profile="general"]
 */
async function getLatestSnapshotsByCollege(collegeId, profile = "general") {
  const rows = await db(TABLE)
    .distinctOn("regimental_no")
    .where({ college_id: collegeId, profile })
    .orderBy("regimental_no")
    .orderBy("computed_at", "desc");
  return rows.map(normalize);
}

module.exports = { insertSnapshot, getLatestByCadet, getLatestSnapshotsByCollege };
