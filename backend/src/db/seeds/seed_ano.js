import bcrypt from "bcrypt";

export async function seed(knex) {
  // Prevent duplicate seed
  const existing = await knex("users")
    .where({ email: "ano@ncc.com" })
    .first();

  if (existing) return;

  const password = "ANO@123"; // temporary
  const password_hash = await bcrypt.hash(password, 10);

  // College
  const [college] = await knex("colleges")
    .insert({ college_name: "Shri Govindram Seksaria Institute of Technology and Science" })
    .returning("*");

  // User
  const [user] = await knex("users")
    .insert({
      username: "ANO Admin",
      email: "ano@ncc.com",
      password_hash,
      role: "ANO",
      college_id: college.college_id,
    })
    .returning("*");

  // ANO Profile
  await knex("anos").insert({
    user_id: user.user_id,
    designation: "Associate NCC Officer",
    appointment_date: new Date(),
  });

  console.log("ANO seeded successfully");
}
