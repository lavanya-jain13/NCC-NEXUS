// Responsibility: Read-only data access for the Intelligence Layer. Fetches the raw
//   operational signals (attendance, quiz, fines, meetings, community, ranks) that
//   the pillar scorers consume.
// Layer: Intelligence (Layer 1) — the ONLY place that touches existing tables.
// Depends on: db/knex (existing Postgres connection) and the frozen legacy tables
//   (SELECT only).
// Must never be depended on by: any existing/legacy module. New only.
// INVARIANT: this file issues SELECT queries exclusively — never INSERT/UPDATE/DELETE.

const db = require("../../db/knex");

function toNum(v, dflt = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

function toBool(v) {
  return v === true || v === "t" || v === 1 || v === "1";
}

/**
 * Return a cadet's identity fields needed to fan out the other pillar queries.
 * @returns {Promise<{userId:number, collegeId:(number|null), rankId:(number|null), joiningYear:(number|null)}|null>}
 */
async function getCadetIdentity(regimentalNo) {
  const row = await db("cadet_profiles")
    .where({ regimental_no: regimentalNo })
    .select("user_id", "college_id", "rank_id", "joining_year")
    .first();
  if (!row) return null;
  return {
    userId: row.user_id,
    collegeId: row.college_id,
    rankId: row.rank_id,
    joiningYear: row.joining_year,
  };
}

/** Return a cadet's college_id, used for multi-tenant scope checks. SELECT only. */
async function getCadetCollegeId(regimentalNo) {
  const row = await db("cadet_profiles")
    .where({ regimental_no: regimentalNo })
    .select("college_id")
    .first();
  return row ? row.college_id : null;
}

/**
 * Ordered attendance observations for one cadet (oldest -> newest).
 * @returns {Promise<Array<{drillId:number, drillDate:(Date|string), status:string, approvedLeave:boolean}>>}
 */
async function getAttendanceObservations(regimentalNo) {
  const rows = await db("attendance_records as ar")
    .join("attendance_drills as ad", "ad.drill_id", "ar.drill_id")
    .leftJoin("leaves as l", function joinApprovedLeave() {
      this.on("l.regimental_no", "=", "ar.regimental_no")
        .andOn("l.drill_id", "=", "ar.drill_id")
        .andOnVal("l.status", "=", "approved");
    })
    .where("ar.regimental_no", regimentalNo)
    .whereNull("ad.deleted_at")
    .orderBy("ad.drill_date", "asc")
    .select(
      "ar.drill_id as drillId",
      "ad.drill_date as drillDate",
      "ar.status as status",
      db.raw('(l.leave_id IS NOT NULL) as "approvedLeave"')
    );

  return rows.map((r) => ({
    drillId: r.drillId,
    drillDate: r.drillDate,
    status: r.status,
    approvedLeave: toBool(r.approvedLeave),
  }));
}

/**
 * Roster of cadets in a college with display fields (for the cohort/Command Center).
 * @returns {Promise<Array<{regimentalNo:string, fullName:string, rankName:(string|null)}>>}
 */
async function getCollegeCadets(collegeId) {
  const rows = await db("cadet_profiles as cp")
    .leftJoin("cadet_ranks as cr", "cr.id", "cp.rank_id")
    .where("cp.college_id", collegeId)
    .orderBy("cp.full_name", "asc")
    .select(
      "cp.regimental_no as regimentalNo",
      "cp.full_name as fullName",
      "cr.rank_name as rankName"
    );
  return rows.map((r) => ({
    regimentalNo: r.regimentalNo,
    fullName: r.fullName,
    rankName: r.rankName || null,
  }));
}

/** Quiz attempts for a cadet (by user_id). Includes all statuses; scorers filter. */
async function getQuizAttempts(userId) {
  if (userId == null) return [];
  const rows = await db("quiz_attempts")
    .where({ user_id: userId })
    .select(
      "submitted_at as submittedAt",
      "accuracy_percent as accuracyPercent",
      "status",
      "created_at as createdAt"
    );
  return rows.map((r) => ({
    submittedAt: r.submittedAt,
    accuracyPercent: r.accuracyPercent == null ? null : Number(r.accuracyPercent),
    status: r.status,
    createdAt: r.createdAt,
  }));
}

/** Fines for a cadet (by regimental_no). */
async function getFines(regimentalNo) {
  const rows = await db("fines")
    .where({ regimental_no: regimentalNo })
    .select("created_at as createdAt", "status");
  return rows.map((r) => ({ createdAt: r.createdAt, status: r.status }));
}

/** Meeting attendance rows for a cadet (by user_id), joined to the meeting date. */
async function getMeetingAttendance(userId) {
  if (userId == null) return [];
  const rows = await db("meeting_attendance as ma")
    .join("meetings as m", "m.meeting_id", "ma.meeting_id")
    .where("ma.user_id", userId)
    .select(
      "m.scheduled_at as meetingDate",
      "ma.percentage_attended as percentageAttended",
      "ma.was_late as wasLate"
    );
  return rows.map((r) => ({
    meetingDate: r.meetingDate,
    percentageAttended: r.percentageAttended == null ? 0 : Number(r.percentageAttended),
    wasLate: toBool(r.wasLate),
  }));
}

/** Total community contributions by a cadet (posts + comments + reactions + poll votes). */
async function getCommunityEventCount(userId) {
  if (userId == null) return 0;
  const [posts, comments, reactions, votes] = await Promise.all([
    db("community_posts").where({ created_by_user_id: userId }).whereNull("deleted_at").count({ c: "*" }).first(),
    db("community_comments").where({ user_id: userId }).whereNull("deleted_at").count({ c: "*" }).first(),
    db("community_reactions").where({ user_id: userId }).count({ c: "*" }).first(),
    db("community_poll_votes").where({ user_id: userId }).count({ c: "*" }).first(),
  ]);
  return toNum(posts.c) + toNum(comments.c) + toNum(reactions.c) + toNum(votes.c);
}

/**
 * Leadership inputs for a cadet: rank position on the ladder, responsibility actions
 * (hosted meetings + authored community posts), influence (engagement received on
 * their cadet-feed posts), and number of promotions.
 * @returns {Promise<{rankIndex:(number|null), totalRanks:number, responsibilityActions:number, influenceCount:number, promotions:number}>}
 */
async function getLeadershipInputs(regimentalNo, userId, rankId) {
  const rankPromise =
    rankId == null
      ? Promise.resolve({ total: 0, idx: null })
      : (async () => {
          const [total, below] = await Promise.all([
            db("cadet_ranks").count({ c: "*" }).first(),
            db("cadet_ranks").where("id", "<", rankId).count({ c: "*" }).first(),
          ]);
          return { total: toNum(total.c), idx: toNum(below.c) };
        })();

  const hostedPromise = userId == null
    ? Promise.resolve({ c: 0 })
    : db("meetings").where({ created_by_user_id: userId }).whereNull("deleted_at").count({ c: "*" }).first();

  const authoredPromise = userId == null
    ? Promise.resolve({ c: 0 })
    : db("community_posts").where({ created_by_user_id: userId }).whereNull("deleted_at").count({ c: "*" }).first();

  const influencePromise = db("posts")
    .where({ regimental_no: regimentalNo })
    .whereNull("deleted_at")
    .select(db.raw("COALESCE(SUM(likes_count + comments_count), 0) as s"))
    .first();

  const historyPromise = db("cadet_rank_history")
    .where({ regimental_no: regimentalNo })
    .count({ c: "*" })
    .first();

  const [rankPos, hosted, authored, influence, history] = await Promise.all([
    rankPromise,
    hostedPromise,
    authoredPromise,
    influencePromise,
    historyPromise,
  ]);

  return {
    rankIndex: rankPos.idx,
    totalRanks: rankPos.total,
    responsibilityActions: toNum(hosted.c) + toNum(authored.c),
    influenceCount: toNum(influence.s),
    // First rank-history row is the initial rank, not a promotion.
    promotions: Math.max(0, toNum(history.c) - 1),
  };
}

module.exports = {
  getCadetIdentity,
  getCadetCollegeId,
  getCollegeCadets,
  getAttendanceObservations,
  getQuizAttempts,
  getFines,
  getMeetingAttendance,
  getCommunityEventCount,
  getLeadershipInputs,
};
