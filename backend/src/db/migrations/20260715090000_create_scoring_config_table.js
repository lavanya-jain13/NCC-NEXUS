/**
 * NCC NEXUS COMMAND — Intelligence Layer
 * M0: scoring_config
 *
 * Additive-only. Stores the tunable, versioned pillar weights used by the
 * (future) readiness scoring engine. No existing table is modified.
 *
 * A row with college_id = NULL represents the system-default weight profile
 * (fallback used before any college customizes its weights). A row with a
 * college_id represents that college's override for a given profile.
 *
 * `weights` is a JSONB object, e.g.:
 *   { "attendance": 20, "discipline": 15, "knowledge": 15, "drill": 15,
 *     "participation": 12, "leadership": 13, "communication": 10 }
 */

exports.up = async function (knex) {
  await knex.schema.createTable("scoring_config", (t) => {
    t.increments("id").primary();

    // NULL = system-default template; otherwise a per-college override.
    t.integer("college_id")
      .references("college_id")
      .inTable("colleges")
      .onDelete("CASCADE");

    // Decision profile this weight set applies to, e.g.
    // 'general' | 'rdc' | 'promotion' | 'certificate'.
    t.string("profile", 32).notNullable().defaultTo("general");

    // Pillar weight map (must sum to 100 at the application layer).
    t.jsonb("weights").notNullable();

    t.integer("version").notNullable().defaultTo(1);
    t.boolean("is_active").notNullable().defaultTo(true);

    // Actor who last updated this config (nullable; SET NULL on user delete).
    t.integer("updated_by")
      .references("user_id")
      .inTable("users")
      .onDelete("SET NULL");

    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.index(["college_id", "profile", "is_active"], "idx_scoring_config_college_profile_active");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("scoring_config");
};
