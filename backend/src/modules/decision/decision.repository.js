// Responsibility: Read/write access for the NEW `intel_risk_flags` table.
// Layer: Decision Support (Layer 2) — data access for the NEW table only.
// Depends on: db/knex and the new `intel_risk_flags` table.
// Must never be depended on by: any existing/legacy module.
// NOTE: This file MAY INSERT/UPDATE — but ONLY the new intel_risk_flags table.
//   It never writes to any existing/legacy table.

const db = require("../../db/knex");

const TABLE = "intel_risk_flags";

function normalize(row) {
  if (!row) return null;
  return {
    ...row,
    data_confidence: row.data_confidence == null ? null : Number(row.data_confidence),
    drivers: typeof row.drivers === "string" ? JSON.parse(row.drivers) : row.drivers,
  };
}

/** Open + acknowledged flags for a college (resolved ones are excluded). */
async function listActiveByCollege(collegeId) {
  const rows = await db(TABLE)
    .where({ college_id: collegeId })
    .whereIn("status", ["open", "acknowledged"])
    .orderBy("created_at", "desc");
  return rows.map(normalize);
}

async function insertFlag(flag) {
  const [row] = await db(TABLE)
    .insert({
      regimental_no: flag.regimental_no,
      college_id: flag.college_id ?? null,
      severity: flag.severity,
      drivers: JSON.stringify(flag.drivers || []),
      recommended_action: flag.recommendedAction ?? null,
      explanation: flag.explanation ?? null,
      data_confidence: flag.dataConfidence ?? null,
      status: "open",
    })
    .returning("*");
  return normalize(row);
}

async function updateFlag(id, flag) {
  const [row] = await db(TABLE)
    .where({ id })
    .update({
      severity: flag.severity,
      drivers: JSON.stringify(flag.drivers || []),
      recommended_action: flag.recommendedAction ?? null,
      explanation: flag.explanation ?? null,
      data_confidence: flag.dataConfidence ?? null,
      updated_at: db.fn.now(),
    })
    .returning("*");
  return normalize(row);
}

async function resolveFlag(id) {
  const [row] = await db(TABLE)
    .where({ id })
    .update({ status: "resolved", updated_at: db.fn.now() })
    .returning("*");
  return normalize(row);
}

async function acknowledgeFlag(id, userId) {
  const [row] = await db(TABLE)
    .where({ id })
    .whereIn("status", ["open"])
    .update({
      status: "acknowledged",
      acknowledged_by: userId ?? null,
      acknowledged_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning("*");
  return normalize(row);
}

/** College of a flag (for multi-tenant scope checks). */
async function getFlagCollege(id) {
  const row = await db(TABLE).where({ id }).select("college_id").first();
  return row ? row.college_id : null;
}

module.exports = {
  listActiveByCollege,
  insertFlag,
  updateFlag,
  resolveFlag,
  acknowledgeFlag,
  getFlagCollege,
};
