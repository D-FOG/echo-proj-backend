import { Router } from "express";

import {
  createNotification,
  listAcademyEnrollments,
  getMessageDetails,
  getAdminOverview,
  getSettings,
  getUserDetails,
  listLogs,
  listMessages,
  listNotifications,
  listPlatformAutomations,
  listUsers,
  replyToMessage,
  resolveMessage,
  updateAcademyEnrollmentStatus,
  updateSettings,
  updateUserStatus,
} from "../controllers/admin.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate, authorize("admin"));

router.get("/overview", getAdminOverview);
router.get("/users", listUsers);
router.get("/users/:id", getUserDetails);
router.put("/users/:id/status", updateUserStatus);
router.get("/automations", listPlatformAutomations);
router.get("/academy/enrollments", listAcademyEnrollments);
router.put("/academy/enrollments/:id/status", updateAcademyEnrollmentStatus);
router.get("/messages", listMessages);
router.get("/messages/:id", getMessageDetails);
router.put("/messages/:id/resolve", resolveMessage);
router.post("/messages/:id/request-complete", resolveMessage);
router.post("/messages/:id/reply", replyToMessage);
router.get("/logs", listLogs);
router.get("/settings", getSettings);
router.put("/settings", updateSettings);
router.get("/notifications", listNotifications);
router.post("/notifications", createNotification);

export default router;
