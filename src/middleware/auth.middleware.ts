import type { NextFunction, Request, Response } from "express";

import User from "../models/User";
import { ApiError } from "../utils/api-error";
import { verifyToken } from "../utils/jwt";

const extractToken = (header?: string): string | null => {
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length);
};

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const token = extractToken(req.headers.authorization);

  if (!token) {
    return next(new ApiError(401, "Authentication required"));
  }

  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.id).select("_id role status tokenVersion");

    if (!user) {
      return next(new ApiError(401, "Account not found"));
    }

    if (user.status !== "active") {
      return next(new ApiError(403, "Account is not active"));
    }

    if (payload.tokenVersion !== user.tokenVersion) {
      return next(new ApiError(401, "Session is no longer valid"));
    }

    req.user = {
      id: String(user._id),
      role: user.role as "user" | "admin",
      tokenVersion: user.tokenVersion,
    };

    return next();
  } catch {
    return next(new ApiError(401, "Invalid or expired token"));
  }
};

export const authorize =
  (...roles: Array<"user" | "admin">) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "You do not have access to this resource"));
    }

    return next();
  };
