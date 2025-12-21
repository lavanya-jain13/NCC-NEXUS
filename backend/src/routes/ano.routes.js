import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { allowRoles } from "../middlewares/role.middleware.js";
import { createUser } from "../controllers/ano.controller.js";

const router = express.Router();

router.post(
  "/create-user",
  authenticate,
  allowRoles("ANO"),
  createUser
);

export default router;
