export async function up(knex) {

  // 1️⃣ COLLEGES
  await knex.schema.createTable("colleges", (t) => {
    t.increments("college_id").primary();
    t.string("college_name").notNullable();
  });

  // 2️⃣ USERS
  await knex.schema.createTable("users", (t) => {
    t.increments("user_id").primary();
    t.string("username").notNullable();
    t.string("email").unique().notNullable();
    t.string("password_hash").notNullable();
    t.enu("role", ["ANO", "CADET", "ALUMNI"]).notNullable();
    t.integer("college_id")
      .references("college_id")
      .inTable("colleges")
      .onDelete("SET NULL");
    t.timestamp("created_at").defaultTo(knex.fn.now());
  });

  // 3️⃣ ANO
  await knex.schema.createTable("anos", (t) => {
    t.increments("ano_id").primary();
    t.integer("user_id").unique()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");
    t.string("designation");
    t.date("appointment_date");
  });

  // 4️⃣ ALUMNI
  await knex.schema.createTable("alumni", (t) => {
    t.increments("alumni_id").primary();
    t.integer("user_id").unique()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");
    t.integer("graduation_year");
    t.string("donation_badges");
  });

  // 5️⃣ CADET PROFILE
  await knex.schema.createTable("cadet_profiles", (t) => {
    t.string("regimental_no").primary();
    t.integer("user_id").unique()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");
    t.string("name");
    t.date("dob");
    t.string("email");
  });

  // 6️⃣ CADET ROLE (WEAK ENTITY)
  await knex.schema.createTable("cadet_roles", (t) => {
    t.increments("role_id").primary();
    t.string("regimental_no")
      .references("regimental_no")
      .inTable("cadet_profiles")
      .onDelete("CASCADE");
    t.string("role_name");
    t.date("start_date");
    t.date("end_date");
  });
}

export async function down(knex) {
  // Reverse order for safe rollback
  await knex.schema.dropTableIfExists("cadet_roles");
  await knex.schema.dropTableIfExists("cadet_profiles");
  await knex.schema.dropTableIfExists("alumni");
  await knex.schema.dropTableIfExists("anos");
  await knex.schema.dropTableIfExists("users");
  await knex.schema.dropTableIfExists("colleges");
}
