import Subscription from "../models/Subscription";
import SubscriptionReminder from "../models/SubscriptionReminder";
import User from "../models/User";
import { env } from "../config/env";
import { sendMail } from "../utils/mailer";
import { getRemainingDays, WARNING_DAYS } from "../utils/subscription-status";

type ReminderType = "expiring" | "expired";
type ReminderRecipientKind = "user" | "admin" | "category";

type ReminderUser = {
  _id?: unknown;
  name?: string;
  email?: string;
  role?: string;
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

type ReminderEmailItem = {
  kind: "category" | "decoder";
  items: ReminderItem[];
  reminderType: ReminderType;
  remainingDays: number;
  endDate?: Date;
  customerName?: string;
  categoryName?: string;
  provider?: string;
  bouquet?: string;
  iucNumber?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MAX_EMAIL_ITEMS = 25;
const UNNAMED_CATEGORY = "No Name Yet";

let timer: NodeJS.Timeout | undefined;
let isRunning = false;

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeCategoryName = (categoryName: string) => categoryName.trim().toLowerCase();

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(date);

const uniqueValues = (values: Array<string | undefined>) =>
  Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));

const hasNamedCategory = (categoryName: string | undefined) => {
  const value = categoryName?.trim();
  return Boolean(value && value !== UNNAMED_CATEGORY && value.toLowerCase() !== "general");
};

const getMostUrgentReminderType = (items: ReminderItem[]): ReminderType =>
  items.some((item) => item.reminderType === "expired") ? "expired" : "expiring";

const getSmallestRemainingDays = (items: ReminderItem[]) =>
  Math.min(...items.map((item) => item.remainingDays));

const getEarliestEndDate = (items: ReminderItem[]) => {
  const timestamps = items
    .map((item) => item.subscription.endDate ? new Date(item.subscription.endDate).getTime() : undefined)
    .filter((value): value is number => value !== undefined);

  return timestamps.length > 0 ? new Date(Math.min(...timestamps)) : undefined;
};

const groupReminderItems = (items: ReminderItem[]): ReminderEmailItem[] => {
  const grouped = new Map<string, ReminderItem[]>();
  const ungrouped: ReminderEmailItem[] = [];

  for (const item of items) {
    const subscription = item.subscription;
    if (!hasNamedCategory(subscription.categoryName)) {
      ungrouped.push({
        kind: "decoder",
        items: [item],
        reminderType: item.reminderType,
        remainingDays: item.remainingDays,
        endDate: subscription.endDate ? new Date(subscription.endDate) : undefined,
        customerName: subscription.customerName || subscription.customer?.name,
        provider: subscription.provider,
        bouquet: subscription.bouquet,
        iucNumber: subscription.iucNumber,
      });
      continue;
    }

    const key = [subscription.provider ?? "provider", normalizeCategoryName(subscription.categoryName ?? "")].join(":");
    const existing = grouped.get(key);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(key, [item]);
    }
  }

  const categoryItems = Array.from(grouped.values()).map((groupItems) => {
    const first = groupItems[0].subscription;
    return {
      kind: "category" as const,
      items: groupItems,
      reminderType: getMostUrgentReminderType(groupItems),
      remainingDays: getSmallestRemainingDays(groupItems),
      endDate: getEarliestEndDate(groupItems),
      customerName: first.customerName || first.customer?.name,
      categoryName: first.categoryName,
      provider: first.provider,
      bouquet: first.bouquet,
    };
  });

  return [...categoryItems, ...ungrouped].sort((a, b) => a.remainingDays - b.remainingDays);
};

const getSubscriptionLabel = (items: ReminderEmailItem[]) => {
  const providers = uniqueValues(items.map((item) => item.provider));
  if (providers.length === 1) return `${providers[0]} subscriptions`;
  return "decoder subscriptions";
};

const getTimingText = (item: ReminderEmailItem) => {
  if (item.reminderType === "expired") {
    const overdueDays = Math.abs(item.remainingDays);
    return overdueDays <= 0 ? "is overdue" : `is overdue by ${overdueDays} day(s)`;
  }

  if (item.remainingDays <= 0) return "expires today";
  return `currently has ${item.remainingDays} day(s) remaining`;
};

const buildReminderFooter = (dashboardUrl: string) => [
  `<p>Kindly check the dashboard for a detailed overview and take the necessary action to ensure uninterrupted service: <a href="${dashboardUrl}">${dashboardUrl}</a></p>`,
  "<p>Please disregard this automated reminder if the necessary action has already been taken.</p>",
  "<p>Kind regards,</p>",
  `<p>From: ${env.subscriptionReminderCompanyName}</p>`,
];

const describeEmailItem = (item: ReminderEmailItem) => {
  const provider = item.provider || "decoder";
  const timing = getTimingText(item);
  const endDate = item.endDate ? ` Expiry date: ${formatDate(item.endDate)}.` : "";

  if (item.kind === "category") {
    const categoryName = item.categoryName || "this category";
    const slotLabel = item.items.length === 1 ? "Slot" : "Slots";
    return `The decoder set on ${categoryName} with ${item.items.length} ${slotLabel} ${timing}.${endDate}`;
  }

  const labelParts = [
    item.bouquet,
    item.iucNumber ? `IUC ${item.iucNumber}` : undefined,
  ].filter(Boolean);
  const decoderLabel = labelParts.length > 0 ? labelParts.join(" - ") : "one decoder";
  return `The ${provider} subscription for ${decoderLabel} ${timing}.${endDate}`;
};

const buildUserEmail = (name: string | undefined, items: ReminderItem[]) => {
  const emailItems = groupReminderItems(items);
  const lines = emailItems.slice(0, MAX_EMAIL_ITEMS).map((item) => `<li>${describeEmailItem(item)}</li>`);
  const extraCount = Math.max(emailItems.length - MAX_EMAIL_ITEMS, 0);
  const hasExpired = items.some((item) => item.reminderType === "expired");
  const subject = hasExpired ? "Decoder subscription expired or overdue" : "Decoder subscription reminder";
  const hasOneItem = emailItems.length === 1;
  const subscriptionLabel = getSubscriptionLabel(emailItems);
  const statusText = hasExpired ? "approaching expiry or already overdue" : "approaching its expiry date";

  return {
    subject,
    html: [
      "<p>Dear Sir,</p>",
      `<p>This is a friendly reminder that ${hasOneItem ? `one of your ${subscriptionLabel} is` : `some of your ${subscriptionLabel} are`} ${statusText}.</p>`,
      `<ul>${lines.join("")}</ul>`,
      extraCount > 0 ? `<p>And ${extraCount} more subscription group(s).</p>` : "",
      ...buildReminderFooter(env.subscriptionReminderDashboardUrl),
    ].join(""),
  };
};

const buildAdminEmail = (items: ReminderItem[]) => {
  const emailItems = groupReminderItems(items);
  const lines = emailItems.slice(0, MAX_EMAIL_ITEMS).map((item) => {
    const customer = item.kind === "decoder" && item.customerName ? `${item.customerName}: ` : "";
    return `<li>${customer}${describeEmailItem(item)}</li>`;
  });
  const extraCount = Math.max(emailItems.length - MAX_EMAIL_ITEMS, 0);

  return {
    subject: "Decoder subscriptions need attention",
    html: [
      "<p>The following decoder subscription(s) are within the reminder window or already overdue:</p>",
      `<ul>${lines.join("")}</ul>`,
      extraCount > 0 ? `<p>And ${extraCount} more subscription group(s).</p>` : "",
      ...buildReminderFooter(env.subscriptionReminderAdminDashboardUrl),
    ].join(""),
  };
};

const getReminderKey = (subscriptionId: unknown, reminderType: ReminderType, recipientKind: ReminderRecipientKind, email: string) =>
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
      getReminderKey(reminder.subscription, reminder.reminderType as ReminderType, reminder.recipientKind as ReminderRecipientKind, reminder.recipientEmail),
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

const recordSentReminders = async (items: ReminderItem[], recipientKind: ReminderRecipientKind, recipientEmail: string, sentAt: Date, recipientUser?: unknown) => {
  if (items.length === 0) return;

  await SubscriptionReminder.insertMany(
    items.map((item) => ({
      subscription: item.subscription._id,
      reminderType: item.reminderType,
      recipientKind,
      ...(recipientUser ? { recipientUser } : {}),
      recipientEmail: normalizeEmail(recipientEmail),
      sentAt,
    })),
    { ordered: false },
  );
};

const getAdminReminderRecipients = async (): Promise<ReminderUser[]> => {
  const admins = await User.find({ role: "admin", status: "active" }).select("name email").lean<ReminderUser[]>();
  const recipientsByEmail = new Map<string, ReminderUser>();
  const extraRecipientEmails = Array.from(new Set(env.subscriptionReminderRecipientEmails.map(normalizeEmail)));
  const extraRecipientUsers = extraRecipientEmails.length > 0
    ? await User.find({ email: { $in: extraRecipientEmails } }).select("name email role status").lean<ReminderUser[]>()
    : [];
  const extraUsersByEmail = new Map(
    extraRecipientUsers
      .filter((user) => user.email)
      .map((user) => [normalizeEmail(user.email!), user]),
  );

  for (const admin of admins) {
    if (!admin.email) continue;
    recipientsByEmail.set(normalizeEmail(admin.email), admin);
  }

  for (const normalizedEmail of extraRecipientEmails) {
    const matchingUser = extraUsersByEmail.get(normalizedEmail);
    if (matchingUser && (matchingUser.role !== "admin" || matchingUser.status !== "active")) continue;

    if (!recipientsByEmail.has(normalizedEmail)) {
      recipientsByEmail.set(normalizedEmail, matchingUser ?? { email: normalizedEmail });
    }
  }

  return Array.from(recipientsByEmail.values());
};

const getCategoryReminderRecipientEntries = () =>
  Object.entries(env.subscriptionReminderCategoryRecipientEmails).map(([categoryName, emails]) => ({
    categoryName,
    normalizedCategoryName: normalizeCategoryName(categoryName),
    emails: Array.from(new Set(emails.map(normalizeEmail))),
  }));

const addReminderItemOnce = (items: ReminderItem[], item: ReminderItem) => {
  const alreadyAdded = items.some(
    (existing) => String(existing.subscription._id) === String(item.subscription._id) && existing.reminderType === item.reminderType,
  );
  if (!alreadyAdded) items.push(item);
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

    const categoryItemsByEmail = new Map<string, ReminderItem[]>();
    for (const entry of getCategoryReminderRecipientEntries()) {
      const categoryItems = items.filter(
        (item) => item.subscription.categoryName && normalizeCategoryName(item.subscription.categoryName) === entry.normalizedCategoryName,
      );
      if (categoryItems.length === 0) continue;

      for (const email of entry.emails) {
        const recipientItems = categoryItemsByEmail.get(email) ?? [];
        for (const item of categoryItems) {
          if (!recentKeys.has(getReminderKey(item.subscription._id, item.reminderType, "category", email))) {
            addReminderItemOnce(recipientItems, item);
          }
        }
        categoryItemsByEmail.set(email, recipientItems);
      }
    }

    for (const [email, recipientItems] of categoryItemsByEmail) {
      if (recipientItems.length === 0) continue;

      const message = buildUserEmail(undefined, recipientItems);
      const sent = await sendMail({ to: email, ...message });
      if (sent) {
        await recordSentReminders(recipientItems, "category", email, now);
      }
    }

    const admins = await getAdminReminderRecipients();
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
