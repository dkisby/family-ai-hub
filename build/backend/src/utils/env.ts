import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../");

dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config({ path: path.join(rootDir, ".env") });

export interface Environment {
  PORT: number;
  FOUNDRY_ENDPOINT: string;
  FOUNDRY_API_KEY: string;
  ENTRA_TENANT_ID: string;
  ENTRA_CLIENT_ID: string;
  ENTRA_API_CLIENT_ID: string;
  ENTRA_ALLOWED_GROUP_IDS: string[];
  FRONTEND_ORIGIN: string;
  CORS_ALLOWED_ORIGINS: string[];
  NODE_ENV: "development" | "production";
}

export function loadEnv(): Environment {
  const corsAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedGroupIds = (process.env.ENTRA_ALLOWED_GROUP_IDS || "")
    .split(",")
    .map((groupId) => groupId.trim())
    .filter(Boolean);

  const env: Environment = {
    PORT: parseInt(process.env.PORT || "3001"),
    FOUNDRY_ENDPOINT: process.env.FOUNDRY_ENDPOINT || "",
    FOUNDRY_API_KEY: process.env.FOUNDRY_API_KEY || "",
    ENTRA_TENANT_ID: process.env.ENTRA_TENANT_ID || "",
    ENTRA_CLIENT_ID: process.env.ENTRA_CLIENT_ID || "",
    ENTRA_API_CLIENT_ID: process.env.ENTRA_API_CLIENT_ID || process.env.ENTRA_CLIENT_ID || "",
    ENTRA_ALLOWED_GROUP_IDS: allowedGroupIds,
    FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || "",
    CORS_ALLOWED_ORIGINS: corsAllowedOrigins,
    NODE_ENV: (process.env.NODE_ENV as "development" | "production") || "development",
  };

  const required = ["FOUNDRY_ENDPOINT", "FOUNDRY_API_KEY", "ENTRA_TENANT_ID"];

  if (env.NODE_ENV === "production") {
    required.push("ENTRA_API_CLIENT_ID");
  }

  for (const key of required) {
    if (!env[key as keyof Environment]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  if (env.NODE_ENV === "production" && !env.FRONTEND_ORIGIN && env.CORS_ALLOWED_ORIGINS.length === 0) {
    throw new Error("Missing CORS config: set FRONTEND_ORIGIN or CORS_ALLOWED_ORIGINS in production");
  }

  return env;
}
