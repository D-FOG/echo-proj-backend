import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";

import { ApiError } from "../utils/api-error";

export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      success: false,
      message: Object.values(error.errors)
        .map((item) => item.message)
        .join(", "),
    });
    return;
  }

  if ("code" in error && error.code === 11000) {
    res.status(409).json({
      success: false,
      message: "A record with the supplied value already exists",
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
