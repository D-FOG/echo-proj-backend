import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { createSubscription, deleteSubscription, getSubscription, getSubscriptionSummary, listRenewalRequests, listSubscriptions, updateRenewalRequest, updateSubscription } from "../controllers/subscription.controller";

const router = Router();
router.use(authenticate, authorize("admin"));
router.get("/summary", getSubscriptionSummary);
router.get("/renewal-requests", listRenewalRequests);
router.put("/renewal-requests/:id", updateRenewalRequest);
router.route("/").get(listSubscriptions).post(createSubscription);
router.route("/:id").get(getSubscription).put(updateSubscription).delete(deleteSubscription);

export default router;
