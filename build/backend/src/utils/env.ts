import dotenv from "dotenv";

dotenv.config();

export interface Environment {
  PORT: number;
  FOUNDRY_ENDPOINT: string;
  FOUNDRY_API_KEY: string;
  ENTRA_TENANT_ID: string;
  NODE_ENV: "development" | "production";
}

export function loadEnv(): Environment {
  const env: Environment = {
    PORT: parseInt(process.env.PORT || "3001"),
    FOUNDRY_ENDPOINT: process.env.FOUNDRY_ENDPOINT || "",
    FOUNDRY_API_KEY: process.env.FOUNDRY_API_KEY || "",
    ENTRA_TENANT_ID: process.env.ENTRA_TENANT_ID || "",
    NODE_ENV: (process.env.NODE_ENV as "development" | "production") || "development",
  };

  const required = ["FOUNDRY_ENDPOINT", "FOUNDRY_API_KEY"];
  for (const key of required) {
    if (!env[key as keyof Environment]) {
      console.warn(`⚠️  Missing environment variable: ${key}`);
    }
  }

  return env;
}
