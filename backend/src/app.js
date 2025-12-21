import dotenv from "dotenv";
dotenv.config(); 

import express from "express";
import db from "./db/knex.js";
import authRoutes from "./routes/auth.routes.js";
import anoRoutes from "./routes/ano.routes.js";

const app = express();

// Middleware
app.use(express.json());

// Health check
app.get("/", async (req, res) => {
  try {
    await db.raw("select 1+1 as result");
    res.json({ status: "Server & DB running" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database not connected" });
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/ano", anoRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
