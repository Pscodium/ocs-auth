import * as dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  ISSUER_URL: z.string().url(),
  AUDIENCE: z.string().min(1),
  CORS_ORIGIN: z.string().optional(),
  // Token expiration times (in seconds)
  ACCESS_TOKEN_EXPIRES_IN: z.coerce.number().int().positive().default(600),           // 10 minutes
  REFRESH_TOKEN_EXPIRES_IN: z.coerce.number().int().positive().default(2592000),     // 30 days
  AUTH_CODE_EXPIRES_IN: z.coerce.number().int().positive().default(300)              // 5 minutes
});

export const env = envSchema.parse(process.env);
