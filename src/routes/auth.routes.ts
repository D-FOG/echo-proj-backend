import { Router } from "express";

import { login, logout, me, register, resetPassword } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, me);
router.post("/reset-password", resetPassword);

export default router;
