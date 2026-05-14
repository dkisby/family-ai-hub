import React, { useEffect, useState } from "react";
import {
  MsalProvider,
  useIsAuthenticated,
  useMsal,
  useAccount,
} from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { ChatUI } from "./components/ChatUI";
import { apiRequest, msalConfig, loginRequest } from "./auth/authConfig";

const pca = new PublicClientApplication(msalConfig);

function AuthenticatedApp() {
  const { accounts, instance } = useMsal();
  const account = useAccount(accounts[0] || null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    const acquireToken = async () => {
      setLoading(true);
      setTokenError(null);

      try {
        if (!account) {
          setLoading(false);
          return;
        }

        const apiTokenResponse = await instance.acquireTokenSilent({
          ...apiRequest,
          account: account ?? undefined,
        });

        setToken(apiTokenResponse.accessToken);
      } catch (error) {
        console.error("Token acquisition failed:", error);
        setToken(null);
        setTokenError("Could not get API access token. Grant API access and try again.");
      } finally {
        setLoading(false);
      }
    };

    acquireToken();
  }, [account, instance]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (tokenError || !token) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Session Error</h1>
          <p className="text-gray-600 mb-6">{tokenError || "No token available"}</p>
          <button
            onClick={() =>
              instance.acquireTokenRedirect(apiRequest).catch((error) => {
                console.error("API consent error:", error);
              })
            }
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Grant API Access
          </button>
        </div>
      </div>
    );
  }

  return <ChatUI authToken={token} preferenceKey={account?.homeAccountId || "anonymous"} />;
}

function AppContent() {
  const isAuthenticated = useIsAuthenticated();
  const { instance } = useMsal();

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Family Hub</h1>
          <p className="text-gray-600 mb-6">AI-Powered Chat Assistant</p>
          <button
            onClick={() =>
              instance.loginRedirect(loginRequest).catch((error) => {
                console.error("Login error:", error);
              })
            }
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return <AuthenticatedApp />;
}

export function App() {
  return (
    <MsalProvider instance={pca}>
      <AppContent />
    </MsalProvider>
  );
}

export default App;
