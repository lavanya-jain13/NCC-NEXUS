/**
 * Responsibility: Additive migration for `readiness_snapshots` — the per-cadet,
 *   point-in-time output of the Intelligence Layer (M2: attendance pillar only).
 * Layer: Migration / DB (new table only; no existing table is modified).
 * Depends on: existing tables `cadet_profiles` (regimental_no) and `colleges`.
 * Must never be depended on by: any existing/legacy migration.
 *
 * `pillars` (JSONB) holds the per-pillar breakdown, e.g.
 *   { "attendance": { score, confidence, trend, evidence, explanation } }.
 * `overall_score` / `overall_confidence` are the aggregate (M2 = attendance only;
 * generalized by the aggregator in a later milestone).
 */

exports.up = async function (knex) {
  await knex.schema.createTable("readiness_snapshots", (t) => {
    t.increments("id").primary();

    t.string("regimental_no", 64)
      .notNullable()
      .references("regimental_no")
      .inTable("cadet_profiles")
      .onDelete("CASCADE");

    t.integer("college_id")
      .references("college_id")
      .inTable("colleges")
      .onDelete("CASCADE");

    // Which weight profile this snapshot was computed under.
    t.string("profile", 32).notNullable().defaultTo("general");

    t.decimal("overall_score", 6, 2); // 0.00–100.00, nullable when no data
    t.decimal("overall_confidence", 4, 3); // 0.000–1.000, nullable when no data

    t.jsonb("pillars").notNullable();

    t.timestamp("computed_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.index(["regimental_no", "computed_at"], "idx_readiness_snapshots_cadet_computed");
    t.index(["college_id", "computed_at"], "idx_readiness_snapshots_college_computed");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("readiness_snapshots");
};
