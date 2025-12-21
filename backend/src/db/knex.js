import dotenv from "dotenv";
dotenv.config(); // 🔥 FORCE ENV LOAD HERE

import knex from "knex";
import config from "../../knexfile.js";

const db = knex({
  client: "pg",
  connection: process.env.POSTGRES_URL,
});

export default db;
