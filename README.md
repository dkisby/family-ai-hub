# Family AI Hub – React + Node.js Chat Application

A production-ready chat application with Azure AD authentication, deployed to Azure Container Apps with a custom domain and managed HTTPS certificate.

## 🎯 Project Overview

**Family AI Hub** is a React-based chat interface integrated with Microsoft Foundry AI models, featuring:

- **React 18 + TypeScript** frontend with Tailwind CSS styling
- **Node.js 20 + Express** backend API with JWT token validation
- **Azure AD (Entra ID)** authentication with SPA/API app separation
- **Azure Container Apps** hosting on custom domain (example: `your-app.example.com`)
- **Managed HTTPS certificate** with automated renewal
- **Rate limiting & CORS security** hardened endpoints
- **Infrastructure-as-Code** Bicep deployment with GitHub Actions CI/CD

---

## 📋 Architecture

### Authentication Flow

```
User Browser
    ↓
[MSAL React] → Azure AD SPA App (<spa-app-client-id>)
    ↓
[Get Identity Token]
    ↓
Frontend acquires API scope → Azure AD API App (<api-app-client-id>)
    ↓
[Get Access Token with api://<api-app-client-id>/access_as_user scope]
    ↓
Backend validates JWT signature via JWKS endpoint
    ↓
[Express API] → POST /api/chat with Bearer token
    ↓
[Foundry Integration] → AI Response
```

### Infrastructure Components

- **Azure Container Registry** – Container image repository
- **Azure Container Apps Environment** – Hosting platform
  - Frontend Container App – React SPA, port 80 → 3000
  - Backend Container App – Express API, port 80 → 3001
- **Azure Container Apps Job** – Scheduled tasks (if configured)
- **Key Vault** – Secret storage (API keys, credentials)
- **Log Analytics Workspace** – Diagnostics and monitoring
- **Azure Managed Certificate** – TLS for custom domain
- **Microsoft Foundry** – AI model endpoint and API key integration

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** (LTS)
- **npm 10+**
- **Docker** (for local container builds)
- **Azure CLI** with OIDC federated credentials
- **GitHub account** with push access to this repository
- **Azure Subscription** with sufficient quota
- **Microsoft Entra ID (Azure AD)** tenant access
- **Microsoft Foundry API key** and endpoint

### Local Development

#### 1. Clone and Install

```bash
git clone https://github.com/<org>/family-ai-hub.git
cd family-ai-hub

# Install dependencies
cd build/frontend && npm install
cd ../backend && npm install
cd ../..
```

#### 2. Configure Environment Variables

**Frontend** (`build/frontend/.env.local`):

```env
VITE_ENTRA_TENANT_ID=<tenant-id>
VITE_ENTRA_CLIENT_ID=<spa-app-id>
VITE_ENTRA_API_CLIENT_ID=<api-app-id>
VITE_ENTRA_API_SCOPE=api://<api-app-id>/access_as_user
VITE_BACKEND_API_URL=http://localhost:3001
```

**Backend** (`build/backend/.env.local`):

```env
ENTRA_TENANT_ID=<tenant-id>
ENTRA_CLIENT_ID=<spa-app-id>
ENTRA_API_CLIENT_ID=<api-app-id>
FRONTEND_ORIGIN=http://localhost:3000
FOUNDRY_ENDPOINT=<foundry-url>
FOUNDRY_API_KEY=<api-key>
NODE_ENV=development
```

#### 3. Run Locally

**Terminal 1 – Backend API:**
```bash
cd build/backend
npm run dev
# Server starts on http://localhost:3001
```

**Terminal 2 – Frontend UI:**
```bash
cd build/frontend
npm run dev
# Dev server starts on http://localhost:3000
```

Visit `http://localhost:3000` and click "Sign in" to test Azure AD authentication.

---

## 🔐 Azure AD Configuration

### Required App Registrations

#### 1. SPA App (Frontend Sign-in)

**Configuration:**
- **Application Type:** Single-Page Application
- **Redirect URIs:**
  - `http://localhost:3000/` (local dev)
  - `http://localhost:3000/auth/callback` (local dev)
  - `https://<your-custom-domain>/` (production)
- **Token Configuration:** Accept default v2.0 tokens
- **API Permissions:**
  - `api://<API_APP_CLIENT_ID>/access_as_user` (Delegated)
  - Status: Admin consent granted ✅

#### 2. API App (Backend Token Validation)

**Configuration:**
- **Application Type:** Web API
- **Application ID URI:** `api://<api-app-id>`
- **Expose an API:**
  - Scope Name: `access_as_user`
  - Admin consent display name: "Access as user"
  - Description: "Access the API on behalf of the user"
- **Token Configuration:**
  - Set `requestedAccessTokenVersion: 2`
  - Enable ID token: ✅
  - Enable access token: ✅

**PowerShell to set token version:**
```powershell
$apiAppObjectId = "<api-app-object-id>"
Update-MgApplication -ApplicationId $apiAppObjectId -RequestedAccessTokenVersion 2
```

### Admin Consent

Navigate to Azure AD → SPA app → API permissions → Grant admin consent for your tenant.

---

## 📦 Deployment

### GitHub Secrets Required

Configure these in your GitHub repository settings:

```
AZURE_CLIENT_ID              # Service principal client ID
AZURE_TENANT_ID              # Azure AD tenant ID
AZURE_SUBSCRIPTION_ID        # Azure subscription ID
ENTRA_CLIENT_ID              # SPA app client ID
ENTRA_API_CLIENT_ID          # API app client ID
ENTRA_API_SCOPE              # api://<api-app-id>/access_as_user
BACKEND_API_URL              # Backend FQDN (https://your-backend.azurecontainerapps.io)
FOUNDRY_ENDPOINT             # Foundry AI endpoint URL
FOUNDRY_API_KEY              # Foundry API authentication key
AZURE_RG                     # Resource group name
```

### One-Command Deploy (with Infra)

```bash
# Create Azure resources + deploy code
az login
az account set --subscription "<subscription-id>"

# Push to main to trigger GitHub Actions
git push origin main
```

Monitor deployment:
- **Phase 1:** `deploy-infra.yml` → Create ACA environment, ACR, Key Vault, managed certificate
- **Phase 2:** `deploy-infra.yml` (Phase 2) → Bind custom domain with CNAME validation
- **Phase 3:** `deploy-react-api.yml` → Build and deploy frontend/backend containers

### Manual Deploy (Code Only)

If infrastructure already exists:

```bash
# Frontend
cd build/frontend
az acr build \
  --registry <your-registry> \
  --image frontend:latest \
  --build-arg VITE_ENTRA_TENANT_ID=$ENTRA_TENANT_ID \
  --build-arg VITE_ENTRA_CLIENT_ID=$ENTRA_CLIENT_ID \
  --build-arg VITE_ENTRA_API_CLIENT_ID=$ENTRA_API_CLIENT_ID \
  --build-arg VITE_ENTRA_API_SCOPE="api://$ENTRA_API_CLIENT_ID/access_as_user" \
  --build-arg VITE_BACKEND_API_URL=$BACKEND_API_URL \
  .

# Backend
cd ../backend
az acr build \
  --registry <your-registry> \
  --image backend:latest \
  .

# Deploy to ACA
az containerapp update \
  --name frontend \
  --resource-group <your-resource-group> \
  --image <your-registry>.azurecr.io/frontend:latest

az containerapp update \
  --name backend \
  --resource-group <your-resource-group> \
  --image <your-registry>.azurecr.io/backend:latest
```

---

## ✅ Verification & Testing

### Health Checks

```bash
# Frontend is serving
curl -s https://<your-custom-domain>/ | head -20

# Backend health endpoint
curl -s https://<your-custom-domain>/api/health
# Expected: {"status":"ok"}

# Backend metrics (with valid JWT)
BEARER_TOKEN=$(curl -s -u $CLIENT_ID:$CLIENT_SECRET -X POST \
  https://login.microsoftonline.com/$TENANT_ID/oauth2/v2.0/token \
  -d "client_id=$ENTRA_API_CLIENT_ID&scope=api://$ENTRA_API_CLIENT_ID/.default&grant_type=client_credentials" \
  | jq -r '.access_token')

curl -s -H "Authorization: Bearer $BEARER_TOKEN" \
  https://hub.kisbyfamily.com/api/health
```

### Manual Chat Test

1. Open https://hub.kisbyfamily.com
2. Click "Sign in" and authenticate with Azure AD
3. Type a message and submit
4. Verify response from Foundry AI model
5. Check backend logs: `az containerapp logs show --name backend-family-hub --resource-group rg-family-ai-hub`

### Monitor Logs

```bash
# Frontend logs
az containerapp logs show \
  --name frontend-family-hub \
  --resource-group rg-family-ai-hub \
  --tail 50

# Backend logs
az containerapp logs show \
  --name backend \
  --resource-group <your-resource-group> \
  --tail 50
```

---

## 🔧 Troubleshooting

### AADSTS50011: Redirect URI Mismatch

**Cause:** SPA app doesn't have the production domain registered.

**Fix:**
1. Azure AD → SPA app → Authentication → Platform configurations → Single-page application
2. Add `https://<your-custom-domain>/` to Redirect URIs
3. Save and wait 5 minutes for token cache to clear

### invalid_resource Error on Token Acquisition

**Cause:** API app not properly exposed or SPA app missing permission.

**Fix:**
1. Verify API app has `Expose an API` with scope `access_as_user`
2. Verify SPA app has API permission for `api://<api-app-id>/access_as_user` with admin consent
3. Check frontend `.env` has correct `VITE_ENTRA_API_CLIENT_ID` and `VITE_ENTRA_API_SCOPE`

### 401 Unauthorized on Backend API

**Cause:** JWT validation failing.

**Diagnosis:**
```bash
# Check backend is receiving correct issuer
az containerapp logs show --name backend --resource-group <your-resource-group> | grep -i "issuer\|audience\|signature"
```

**Common fixes:**
1. Verify `requestedAccessTokenVersion: 2` set on API app
2. Verify backend has correct `ENTRA_TENANT_ID` and `ENTRA_API_CLIENT_ID`
3. Verify JWKS endpoint is reachable: `curl https://login.microsoftonline.com/<your-tenant-id>/discovery/v2.0/keys`

### 403 Forbidden (Rate Limiting)

**Cause:** express-rate-limit threshold exceeded.

**Rate Limits:**
- General API endpoints: 100 requests per 15 minutes per IP
- Chat endpoint: 30 requests per 15 minutes per IP

**Fix:** Wait 15 minutes or change IP, or adjust rate limits in `build/backend/src/server.ts`

---

## 📁 Project Structure

```
family-ai-hub/
├── build/
│   ├── frontend/               # React SPA
│   │   ├── src/
│   │   │   ├── auth/          # MSAL config
│   │   │   ├── components/    # React components
│   │   │   ├── services/      # API client
│   │   │   └── App.tsx        # Main component
│   │   ├── Dockerfile         # Multi-stage build (Node 20 MCR)
│   │   └── package.json       # Dependencies (vite 8.0.12, @msal/react, etc.)
│   └── backend/                # Node.js Express API
│       ├── src/
│       │   ├── services/      # Auth, Foundry integration
│       │   ├── routes/        # API endpoints
│       │   ├── middleware/    # Auth, CORS, rate limiting
│       │   └── server.ts      # Express setup
│       ├── Dockerfile         # Multi-stage build (Node 20 MCR)
│       └── package.json       # Dependencies (express, jose, express-rate-limit, etc.)
├── infra/
│   ├── main.bicep             # Main orchestration
│   └── modules/               # Bicep modules (ACA, managed cert, etc.)
├── .github/
│   └── workflows/
│       ├── deploy-infra.yml   # Two-phase infrastructure deployment
│       └── deploy-react-api.yml # Frontend & backend build/deploy
├── README.md                  # This file
└── BUILD_STATUS.md            # Build status and dependency report
```

---

## 📊 Production Status

| Component | Status | Version |
|-----------|--------|----------|
| Frontend | ✅ Production | React 18, Vite 8.0.12 |
| Backend | ✅ Production | Node.js 20, Express |
| Auth | ✅ Production | MSAL v2.0, JWT JWKS validation |
| Infra | ✅ Production | Bicep IaC, ACA, custom domain |
| Security | ✅ Hardened | 0 npm vulnerabilities, rate limiting |
| Monitoring | ✅ Enabled | Log Analytics, Application Insights |

See [BUILD_STATUS.md](BUILD_STATUS.md) for detailed dependency report.

---

## 🚨 Security Checklist

- ✅ Frontend: MSAL with v2.0 tokens, no hardcoded secrets
- ✅ Backend: JWT signature validation via JWKS, issuer verification, audience validation
- ✅ Backend: CORS restricted to `FRONTEND_ORIGIN`
- ✅ Backend: Rate limiting on all endpoints
- ✅ Backend: Global crypto polyfill for jose library
- ✅ Infrastructure: Managed certificate with auto-renewal
- ✅ Infrastructure: Key Vault for secrets storage
- ✅ Infrastructure: Log Analytics for audit trail
- ✅ Dependencies: All npm packages at latest secure versions (0 vulnerabilities)
- ✅ Container images: Node 20 MCR mirror (no Docker Hub dependencies)

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -am 'Add feature'`
3. Push to branch: `git push origin feature/your-feature`
4. Create a Pull Request

CI/CD will automatically:
- Run linting and type checks
- Build Docker images
- Deploy to staging (optional)
- Await manual approval for production

---

## 📝 License

MIT License – see LICENSE file for details.

---

## 📧 Support

For issues:
1. Check [Troubleshooting](#troubleshooting) section
2. Review [BUILD_STATUS.md](BUILD_STATUS.md) for known issues
3. Check GitHub Issues
4. Contact: [your-email@example.com]

---

**Last Updated:** May 12, 2026
