import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY is required"),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  CORS_ORIGINS: z.string().default("*"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed.");
}

export const env = {
  ...parsed.data,
  corsOrigins:
    parsed.data.CORS_ORIGINS === "*"
      ? ["*"]
      : parsed.data.CORS_ORIGINS.split(",").map((o) => o.trim()),
};

