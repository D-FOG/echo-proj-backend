export type SubscriptionStatus = "active" | "warning" | "expiring_soon" | "expired";

export const getRemainingDays = (endDate: Date, now = new Date()): number =>
  Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

export const getSubscriptionStatus = (endDate: Date, now = new Date()): SubscriptionStatus => {
  if (endDate.getTime() < now.getTime()) return "expired";
  const remainingDays = getRemainingDays(endDate, now);
  if (remainingDays <= 5) return "expiring_soon";
  if (remainingDays <= 15) return "warning";
  return "active";
};

export const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
};
