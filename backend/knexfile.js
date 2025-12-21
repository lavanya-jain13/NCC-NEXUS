import dotenv from "dotenv";
dotenv.config();

export default {
  development: {
    client: "pg",
    connection: process.env.POSTGRES_URL,
    migrations: {
      directory: "./src/db/migrations",
    },
    seeds: {
      directory: "./src/db/seeds",
    },
  },
};
