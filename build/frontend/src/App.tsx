import React, { useEffect, useState } from "react";
import {
  MsalProvider,
  useIsAuthenticated,
  useMsal,
  useAccount,
} from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { ChatUI } from "./components/ChatUI";
import { msalConfig, loginRequest } from "./auth/authConfig";

const pca = new PublicClientApplication(msalConfig);

function AuthenticatedApp() {
  const { accounts } = useMsal();
  const account = useAccount(accounts[0] || null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const acquireToken = async () => {
      try {
        const response = await pca.acquireTokenSilent({
          ...loginRequest,
          account: account || undefined,
        });
        setToken(response.accessToken);
      } catch (error) {
        console.error("Token acquisition failed:", error);
        setLoading(false);
      }
    };

    if (account) {
      acquireToken();
    }
  }, [account]);

  if (loading || !token) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <ChatUI authToken={token} />;
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
            onClick={() => instance.loginPopup(loginRequest)}
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
