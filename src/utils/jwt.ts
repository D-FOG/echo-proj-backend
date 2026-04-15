import jwt from "jsonwebtoken";

import { env } from "../config/env";

export type JwtPayload = {
  id: string;
  role: "user" | "admin";
  tokenVersion: number;
};

export const signToken = (payload: JwtPayload): string =>
  jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });

export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, env.jwtSecret) as JwtPayload;
