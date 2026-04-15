import AuditLog from "../models/AuditLog";

type AuditParams = {
  actorId?: string;
  actorRole?: "user" | "admin" | "system";
  action: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
};

export const createAuditLog = async ({
  actorId,
  actorRole = "system",
  action,
  targetId,
  targetType,
  metadata,
}: AuditParams): Promise<void> => {
  await AuditLog.create({
    actorId,
    actorRole,
    action,
    targetId,
    targetType,
    metadata,
  });
};
