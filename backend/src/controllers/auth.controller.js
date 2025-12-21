import db from "../db/knex.js";
import bcrypt from "bcrypt";
import { generateToken } from "../utils/jwt.js";

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await db("users").where({ email }).first();
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken({
      user_id: user.user_id,
      role: user.role,
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        user_id: user.user_id,
        role: user.role,
        email: user.email,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
