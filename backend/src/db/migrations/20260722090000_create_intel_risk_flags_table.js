/**
 * Responsibility: Additive migration for `intel_risk_flags` — persisted at-risk
 *   cadet flags produced by the Decision layer (M7).
 * Layer: Migration / DB (new table only; no existing table is modified).
 * Depends on: existing tables cadet_profiles (regimental_no), colleges, users.
 * Must never be depended on by: any existing/legacy migration.
 *
 * Lifecycle: status open -> acknowledged (by an officer) -> resolved (auto, when
 * the cadet is no longer at risk on a later scan). `drivers` (JSONB) stores the
 * explainable risk drivers from the at-risk recipe.
 */

exports.up = async function (knex) {
  await knex.schema.createTable("intel_risk_flags", (t) => {
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

    t.string("severity", 16).notNullable().defaultTo("low"); // low | medium | high
    t.jsonb("drivers").notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    t.text("recommended_action");
    t.text("explanation");
    t.decimal("data_confidence", 4, 3);

    t.string("status", 16).notNullable().defaultTo("open"); // open | acknowledged | resolved
    t.integer("acknowledged_by")
      .references("user_id")
      .inTable("users")
      .onDelete("SET NULL");
    t.timestamp("acknowledged_at");

    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.index(["college_id", "status", "severity"], "idx_risk_flags_college_status_sev");
    t.index(["regimental_no", "status"], "idx_risk_flags_cadet_status");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("intel_risk_flags");
};
