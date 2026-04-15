import { Router } from "express";

import {
  changePassword,
  createAutomation,
  completeSupportMessage,
  getSupportMessage,
  createSupportMessage,
  deleteAutomation,
  fundWallet,
  getAutomation,
  getOverview,
  getProfile,
  listSupportMessages,
  replyToSupportMessage,
  getTransactions,
  listAutomations,
  runAutomationNow,
  updateAutomationStatus,
  updateAutomation,
  updateProfile,
} from "../controllers/user.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate, authorize("user"));

router.get("/overview", getOverview);
router.get("/transactions", getTransactions);
router.post("/wallet/fund", fundWallet);
router.get("/automations", listAutomations);
router.post("/automations", createAutomation);
router.get("/automations/:id", getAutomation);
router.put("/automations/:id", updateAutomation);
router.put("/automations/:id/status", updateAutomationStatus);
router.post("/automations/:id/run", runAutomationNow);
router.delete("/automations/:id", deleteAutomation);
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.put("/password", changePassword);
router.get("/support/messages", listSupportMessages);
router.post("/support/messages", createSupportMessage);
router.get("/support/messages/:id", getSupportMessage);
router.post("/support/messages/:id/reply", replyToSupportMessage);
router.post("/support/messages/:id/complete", completeSupportMessage);

export default router;
