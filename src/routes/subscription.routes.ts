import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { createSubscription, deleteSubscription, getSubscription, getSubscriptionSummary, listSubscriptions, updateSubscription } from "../controllers/subscription.controller";

const router = Router();
router.use(authenticate, authorize("admin"));
router.get("/summary", getSubscriptionSummary);
router.route("/").get(listSubscriptions).post(createSubscription);
router.route("/:id").get(getSubscription).put(updateSubscription).delete(deleteSubscription);

export default router;
