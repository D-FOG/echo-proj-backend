import Subscription from "../models/Subscription";
import SubscriptionReminder from "../models/SubscriptionReminder";
import User from "../models/User";
import { env } from "../config/env";
import { sendMail } from "../utils/mailer";
import { getRemainingDays, WARNING_DAYS } from "../utils/subscription-status";

type ReminderType = "expiring" | "expired";

type ReminderUser = {
  _id: unknown;
  name?: string;
  email?: string;
  status?: string;
  notificationPreferences?: {
    emailNotifications?: boolean;
    billingAlerts?: boolean;
  };
};

type ReminderSubscription = {
  _id: unknown;
  customer?: ReminderUser | null;
  customerName?: string;
  categoryName?: string;
  iucNumber?: string;
  provider?: string;
  bouquet?: string;
  endDate?: Date;
};

type ReminderItem = {
  subscription: ReminderSubscription;
  reminderType: ReminderType;
  remainingDays: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MAX_EMAIL_ITEMS = 25;

let timer: NodeJS.Timeout | undefined;
let isRunning = false;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(date);

const describeSubscription = (item: ReminderItem) => {
  const subscription = item.subscription;
  const name = subscription.customerName || subscription.customer?.name || "Customer";
  const labelParts = [
    subscription.provider,
    subscription.bouquet,
    subscription.categoryName,
    subscription.iucNumber ? `IUC ${subscription.iucNumber}` : undefined,
  ].filter(Boolean);
  const label = labelParts.join(" - ") || "Decoder subscription";
  const endDate = subscription.endDate ? formatDate(new Date(subscription.endDate)) : "unknown date";
  const timing = item.reminderType === "expired"
    ? `expired ${Math.abs(item.remainingDays)} day(s) ago`
    : `expires in ${item.remainingDays} day(s)`;

  return `${name}: ${label} (${timing}, ${endDate})`;
};

const buildUserEmail = (name: string | undefined, items: ReminderItem[]) => {
  const lines = items.slice(0, MAX_EMAIL_ITEMS).map((item) => `<li>${describeSubscription(item)}</li>`);
  const extraCount = Math.max(items.length - MAX_EMAIL_ITEMS, 0);
  const hasExpired = items.some((item) => item.reminderType === "expired");
  const subject = hasExpired ? "Decoder subscription expired or overdue" : "Decoder subscription reminder";

  return {
    subject,
    html: [
      `<p>Hello ${name || "there"},</p>`,
      "<p>This is a reminder about your decoder subscription status:</p>",
      `<ul>${lines.join("")}</ul>`,
      extraCount > 0 ? `<p>And ${extraCount} more decoder subscription(s).</p>` : "",
      `<p>You can review your subscriptions here: <a href="${env.clientUrl}/dashboard/subscriptions">${env.clientUrl}/dashboard/subscriptions</a></p>`,
    ].join(""),
  };
};

const buildAdminEmail = (items: ReminderItem[]) => {
  const lines = items.slice(0, MAX_EMAIL_ITEMS).map((item) => `<li>${describeSubscription(item)}</li>`);
  const extraCount = Math.max(items.length - MAX_EMAIL_ITEMS, 0);

  return {
    subject: "Decoder subscriptions need attention",
    html: [
      "<p>The following decoder subscription(s) are within the reminder window or already overdue:</p>",
      `<ul>${lines.join("")}</ul>`,
      extraCount > 0 ? `<p>And ${extraCount} more decoder subscription(s).</p>` : "",
      `<p>Open the admin dashboard: <a href="${env.clientUrl}/admin/subscriptions">${env.clientUrl}/admin/subscriptions</a></p>`,
    ].join(""),
  };
};

const getReminderKey = (subscriptionId: unknown, reminderType: ReminderType, recipientKind: "user" | "admin", email: string) =>
  `${String(subscriptionId)}:${reminderType}:${recipientKind}:${normalizeEmail(email)}`;

const getDueSubscriptions = async (now: Date): Promise<ReminderItem[]> => {
  const reminderCutoff = new Date(now.getTime() + WARNING_DAYS * DAY_MS);
  const subscriptions = await Subscription.find({
    lifecycleStatus: { $ne: "pending" },
    endDate: { $lte: reminderCutoff },
  })
    .populate("customer", "name email status notificationPreferences")
    .sort({ endDate: 1 })
    .limit(env.subscriptionReminderBatchSize)
    .lean<ReminderSubscription[]>();

  return subscriptions
    .filter((subscription) => subscription.endDate)
    .map((subscription) => {
      const endDate = new Date(subscription.endDate as Date);
      return {
        subscription,
        reminderType: endDate.getTime() < now.getTime() ? "expired" : "expiring",
        remainingDays: getRemainingDays(endDate, now),
      };
    });
};

const getRecentReminderKeys = async (items: ReminderItem[], since: Date) => {
  const subscriptionIds = items.map((item) => item.subscription._id);
  const reminders = await SubscriptionReminder.find({
    subscription: { $in: subscriptionIds },
    sentAt: { $gte: since },
  }).lean();

  return new Set(
    reminders.map((reminder) =>
      getReminderKey(reminder.subscription, reminder.reminderType as ReminderType, reminder.recipientKind as "user" | "admin", reminder.recipientEmail),
    ),
  );
};

const userCanReceiveReminder = (user: ReminderUser | null | undefined) =>
  Boolean(
    user?.email &&
      user.status !== "suspended" &&
      user.status !== "banned" &&
      user.notificationPreferences?.emailNotifications !== false &&
      user.notificationPreferences?.billingAlerts !== false,
  );

const recordSentReminders = async (items: ReminderItem[], recipientKind: "user" | "admin", recipientEmail: string, sentAt: Date, recipientUser?: unknown) => {
  if (items.length === 0) return;

  await SubscriptionReminder.insertMany(
    items.map((item) => ({
      subscription: item.subscription._id,
      reminderType: item.reminderType,
      recipientKind,
      recipientUser,
      recipientEmail: normalizeEmail(recipientEmail),
      sentAt,
    })),
    { ordered: false },
  );
};

export const runSubscriptionReminderJob = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    const now = new Date();
    const items = await getDueSubscriptions(now);
    if (items.length === 0) return;

    const recentKeys = await getRecentReminderKeys(items, new Date(now.getTime() - WEEK_MS));
    const itemsByUserEmail = new Map<string, { user: ReminderUser; items: ReminderItem[] }>();

    for (const item of items) {
      const user = item.subscription.customer;
      if (!userCanReceiveReminder(user)) continue;

      const email = normalizeEmail(user!.email!);
      const key = getReminderKey(item.subscription._id, item.reminderType, "user", email);
      if (recentKeys.has(key)) continue;

      const existing = itemsByUserEmail.get(email);
      if (existing) {
        existing.items.push(item);
      } else {
        itemsByUserEmail.set(email, { user: user!, items: [item] });
      }
    }

    for (const [email, payload] of itemsByUserEmail) {
      const message = buildUserEmail(payload.user.name, payload.items);
      const sent = await sendMail({ to: email, ...message });
      if (sent) {
        await recordSentReminders(payload.items, "user", email, now, payload.user._id);
      }
    }

    const admins = await User.find({ role: "admin", status: "active" }).select("name email").lean<ReminderUser[]>();
    for (const admin of admins) {
      if (!admin.email) continue;

      const email = normalizeEmail(admin.email);
      const adminItems = items.filter((item) => !recentKeys.has(getReminderKey(item.subscription._id, item.reminderType, "admin", email)));
      if (adminItems.length === 0) continue;

      const message = buildAdminEmail(adminItems);
      const sent = await sendMail({ to: email, ...message });
      if (sent) {
        await recordSentReminders(adminItems, "admin", email, now, admin._id);
      }
    }
  } catch (error) {
    console.error("Subscription reminder job failed:", error);
  } finally {
    isRunning = false;
  }
};

export const startSubscriptionReminderScheduler = () => {
  if (!env.subscriptionReminderEnabled) {
    console.log("Subscription reminder scheduler disabled.");
    return;
  }

  if (timer) return;

  const intervalMs = env.subscriptionReminderIntervalMinutes * 60 * 1000;
  setTimeout(() => {
    void runSubscriptionReminderJob();
  }, 10_000).unref();

  timer = setInterval(() => {
    void runSubscriptionReminderJob();
  }, intervalMs);
  timer.unref();

  console.log(`Subscription reminder scheduler running every ${env.subscriptionReminderIntervalMinutes} minute(s).`);
};
