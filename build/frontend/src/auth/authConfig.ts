import { PublicClientApplication, LogLevel } from "@azure/msal-browser";

const ENTRA_TENANT_ID = import.meta.env.VITE_ENTRA_TENANT_ID || "";
const ENTRA_CLIENT_ID = import.meta.env.VITE_ENTRA_CLIENT_ID || "";
const ENTRA_API_CLIENT_ID = import.meta.env.VITE_ENTRA_API_CLIENT_ID || ENTRA_CLIENT_ID;
const ENTRA_API_SCOPE =
  import.meta.env.VITE_ENTRA_API_SCOPE || `api://${ENTRA_API_CLIENT_ID}/access_as_user`;

function normalizeBackendApiUrl(value: string | undefined): string {
  if (!value) {
    return "http://localhost:3000";
  }

  const trimmedValue = value.trim();
  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  return "https://" + trimmedValue;
}

const BACKEND_API_URL = normalizeBackendApiUrl(import.meta.env.VITE_BACKEND_API_URL);

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
  scopes: [ENTRA_API_SCOPE],
};

export const publicClientApplication = new PublicClientApplication(msalConfig);

export { BACKEND_API_URL };
