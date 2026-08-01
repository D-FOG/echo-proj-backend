import Subscription from "../models/Subscription";

/**
 * Scheduler-ready query for a future email/SMS/push reminder job. The caller
 * decides delivery and de-duplication; this service intentionally has no side effects.
 */
export const findSubscriptionsDueForReminder = async (daysAhead: number) => {
  const now = new Date();
  const reminderCutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return Subscription.find({ endDate: { $gte: now, $lte: reminderCutoff } })
    .populate("customer", "name email phone")
    .populate("createdBy", "name email")
    .sort({ endDate: 1 });
};
