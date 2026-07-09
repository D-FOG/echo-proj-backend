import { Router } from "express";

import { createAcademyEnrollment } from "../controllers/academy.controller";

const router = Router();

router.post("/enrollments", createAcademyEnrollment);

export default router;
