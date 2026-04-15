import bcrypt from "bcryptjs";

export const hashPassword = (value: string): Promise<string> => bcrypt.hash(value, 12);

export const comparePassword = (value: string, hash: string): Promise<boolean> =>
  bcrypt.compare(value, hash);
