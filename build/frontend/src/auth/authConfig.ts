import { PublicClientApplication, LogLevel } from "@azure/msal-browser";

const ENTRA_TENANT_ID = import.meta.env.VITE_ENTRA_TENANT_ID || "";
const ENTRA_CLIENT_ID = import.meta.env.VITE_ENTRA_CLIENT_ID || "";
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || "http://localhost:3000";

export const msalConfig = {
  auth: {
    clientId: ENTRA_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${ENTRA_TENANT_ID}`,
    redirectUri: `${window.location.origin}`,
  },
  cache: {
    cacheLocation: "localStorage",
  },
  system: {
    loggerOptions: {
      loggerCallback: (level: LogLevel, message: string, piiEnabled: boolean) => {
        if (message.includes("MSAL")) {
          console.log(`[MSAL] ${message}`);
        }
      },
      piiLoggingEnabled: false,
      logLevel: LogLevel.Info,
    },
  },
};

export const loginRequest = {
  scopes: ["openid", "profile", "email"],
};

export const apiRequest = {
  scopes: [`api://${ENTRA_CLIENT_ID}/.default`],
};

export const publicClientApplication = new PublicClientApplication(msalConfig);

export { BACKEND_API_URL };
