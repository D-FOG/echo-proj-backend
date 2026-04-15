import mongoose from "mongoose";

import { connectToDatabase } from "../config/db";
import User from "../models/User";
import { hashPassword } from "../utils/password";

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
};

const createSuperAdmin = async (): Promise<void> => {
  const name = getRequiredEnv("SUPER_ADMIN_NAME");
  const email = getRequiredEnv("SUPER_ADMIN_EMAIL").toLowerCase();
  const password = getRequiredEnv("SUPER_ADMIN_PASSWORD");
  const phone = process.env.SUPER_ADMIN_PHONE;

  await connectToDatabase();

  const existingAdmin = await User.findOne({ email });

  if (existingAdmin) {
    existingAdmin.name = name;
    existingAdmin.phone = phone;
    existingAdmin.role = "admin";
    existingAdmin.status = "active";
    existingAdmin.password = await hashPassword(password);
    await existingAdmin.save();

    console.log(`Updated existing admin account for ${email}`);
    return;
  }

  await User.create({
    name,
    email,
    password: await hashPassword(password),
    phone,
    role: "admin",
    status: "active",
  });

  console.log(`Created super admin account for ${email}`);
};

createSuperAdmin()
  .catch((error: unknown) => {
    console.error("Failed to create super admin", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
