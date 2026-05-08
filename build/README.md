# Family Hub Chat UI - React Frontend + Backend API

A modern, AI-powered chat interface built with React, TypeScript, and Node.js, integrated with Azure Foundry and Entra authentication.

## 📁 Project Structure

```
build/
├── frontend/       # React SPA (Vite + TypeScript)
├── backend/        # Node.js/Express API
└── tools/          # MCP tool server (template)
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (frontend) and 20+ (backend)
- npm or yarn
- Azure CLI (for deployment)
- Visual Studio Code (recommended)

### Local Development

#### 1. Frontend

```bash
cd build/frontend

# Install dependencies
npm install

# Create .env.local from .env.example
cp .env.example .env.local

# Update .env.local with your Entra credentials and backend URL
# VITE_ENTRA_TENANT_ID=your-tenant-id
# VITE_ENTRA_CLIENT_ID=your-client-id
# VITE_BACKEND_API_URL=http://localhost:3001

# Start development server
npm run dev
# Opens http://localhost:3000
```

#### 2. Backend API

```bash
cd build/backend

# Install dependencies
npm install

# Create .env from .env.example
cp .env.example .env

# Update .env with Foundry credentials
# FOUNDRY_ENDPOINT=https://ai-family-hub.openai.azure.com
# FOUNDRY_API_KEY=your-api-key

# Start development server
npm run dev
# Server runs on http://localhost:3001
```

#### 3. Test the integration

```bash
# In another terminal, test the backend health endpoint
curl http://localhost:3001/health
# Response: {"status":"ok","timestamp":"..."}

# Open frontend in browser
open http://localhost:3000

# Sign in with your Entra credentials
# Type a message and submit
# Backend should call Foundry and stream response
```

## 🏗️ Backend Architecture

### API Endpoints

#### `GET /health`
Health check endpoint (no auth required)

```bash
curl http://localhost:3001/health
```

#### `POST /api/chat`
Send a chat message and get response

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is 2 + 2?"}
    ],
    "systemPrompt": "You are a helpful AI assistant."
  }'
```

#### `POST /api/chat/stream`
Stream chat responses (NDJSON format)

```bash
curl -X POST http://localhost:3001/api/chat/stream \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Tell me a story"}
    ]
  }' \
  | jq '.'
```

### Service Layers

- **FoundryService** (`services/foundry.ts`)
  - Calls Azure Foundry (OpenAI) API
  - Supports streaming responses
  - Handles API key authentication

- **ToolService** (`services/tools.ts`)
  - MCP-style tool dispatch system
  - Built-in tools: calculator, get_time, search
  - Extensible: add new tools via `.register()`

- **AuthService** (`services/auth.ts`)
  - Validates Entra tokens
  - Extracts Bearer tokens from headers
  - Future: signature validation against Microsoft keys

### Middleware

- **authMiddleware** (`middleware/auth.ts`)
  - Requires valid Authorization header
  - Validates Entra token
  - Injects user context into request

## 🎨 Frontend Architecture

### Components

- **ChatUI** (`components/ChatUI.tsx`)
  - Main chat interface (OpenAI-style)
  - Message display and input
  - Streaming response support
  - Tool call visualization

- **App** (`App.tsx`)
  - Entra authentication with MSAL
  - Sign in / sign out logic
  - Token acquisition for API calls

### Services

- **API Client** (`services/api.ts`)
  - HTTP client for backend
  - Streaming message handler
  - Bearer token injection

- **Auth Config** (`auth/authConfig.ts`)
  - MSAL configuration
  - Entra tenant and client setup
  - API scope definition

## 🔐 Authentication Flow

```
1. User opens React app
   └─> MSAL checks for cached token
   └─> If not found, redirect to Azure AD login

2. User signs in with Entra credentials
   └─> Redirect back to app with token

3. App acquires API access token
   └─> Token includes scopes for backend API

4. Frontend sends API request with Bearer token
   └─> Authorization: Bearer <token>

5. Backend validates token
   └─> Extracts user identity (oid, email, name)
   └─> Proceeds with request
```

## 📦 Deployment

### Prerequisites for Azure Deployment

- Azure subscription
- Resource group: `rg-family-ai-hub`
- Foundry resource: `ai-family-hub`
- Container registry: `acrfamilyhub.azurecr.io`
- Entra app registration for authentication

### Deploy with GitHub Actions

1. **Create GitHub Secrets** in your repository:
   ```
   AZURE_CLIENT_ID              # Service principal client ID
   AZURE_TENANT_ID              # Azure tenant ID
   AZURE_SUBSCRIPTION_ID        # Azure subscription ID
   ENTRA_TENANT_ID              # Entra directory ID
   ENTRA_CLIENT_ID              # Entra app client ID
   ENTRA_CLIENT_SECRET          # Entra app client secret (for backend)
   BACKEND_API_URL              # https://backend-family-hub.region.azurecontainerapps.io
   AZURE_STATIC_WEB_APPS_API_TOKEN  # From Azure Portal (SWA)
   ```

2. **Push to main branch**:
   ```bash
   git add .
   git commit -m "feat: add React frontend and backend API"
   git push origin main
   ```

3. **Monitor deployment**:
   - Go to GitHub Actions → `Build & Deploy React Frontend + Backend`
   - Watch build, test, and deploy steps

### Manual Deployment with Azure CLI

#### 1. Build Backend Docker Image

```bash
cd build/backend

# Build and push to ACR
az acr build \
  --registry acrfamilyhub \
  --image backend-family-hub:latest \
  --file Dockerfile \
  .
```

#### 2. Deploy Backend to Container Apps

```bash
az containerapp update \
  --name backend-family-hub \
  --resource-group rg-family-ai-hub \
  --image acrfamilyhub.azurecr.io/backend-family-hub:latest
```

#### 3. Deploy Frontend to Static Web App

```bash
cd build/frontend
npm run build

# Deploy via Static Web App CLI
swa deploy build/frontend/dist --env production
```

## 🛠️ Configuration

### Environment Variables

**Frontend** (`.env.local`):
```
VITE_ENTRA_TENANT_ID=your-tenant-id
VITE_ENTRA_CLIENT_ID=your-app-id
VITE_BACKEND_API_URL=https://backend-family-hub.{region}.azurecontainerapps.io
```

**Backend** (`.env`):
```
PORT=3001
FOUNDRY_ENDPOINT=https://ai-family-hub.openai.azure.com
FOUNDRY_API_KEY=your-api-key
ENTRA_TENANT_ID=your-tenant-id
NODE_ENV=production
```

## 📊 Monitoring & Logging

### Backend Logs

The backend logs to console in development. For production:

1. **Azure Container Apps Insights**:
   ```bash
   az containerapp logs show \
     --name backend-family-hub \
     --resource-group rg-family-ai-hub
   ```

2. **Log Analytics**:
   - Backend logs to Application Insights
   - Query via Log Analytics in Azure Portal

### Frontend Errors

- Browser console (F12)
- Network tab for API calls
- Azure Application Insights (if enabled)

## 🧪 Testing

### Backend Unit Tests

```bash
cd build/backend
npm test
```

### API Testing with cURL

```bash
# Health check
curl http://localhost:3001/health

# Chat message (requires valid token)
curl -X POST http://localhost:3001/api/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"messages":[{"role":"user","content":"hello"}]}'
```

### Frontend E2E Tests

```bash
cd build/frontend
npm run test:e2e
```

## 🚨 Troubleshooting

### "Unauthorized" response from backend

- Ensure token is being sent: `Authorization: Bearer <token>`
- Verify Entra configuration matches
- Check token hasn't expired

### Backend can't reach Foundry

- Verify `FOUNDRY_ENDPOINT` is correct
- Verify `FOUNDRY_API_KEY` is valid
- Check network connectivity to Azure

### Frontend won't load chat

- Check browser console for errors
- Verify `VITE_BACKEND_API_URL` matches running backend
- Ensure CORS is enabled on backend

### Docker build fails

- Ensure Node.js dependencies are installed
- Check Dockerfile paths are relative to working directory
- Run `npm install` locally first to verify

## 📝 Adding New Tools

To add a new MCP-style tool:

### 1. Define tool in `backend/src/services/tools.ts`:

```typescript
this.register({
  name: 'my_tool',
  description: 'Description of what this tool does',
  handler: async (input: Record<string, unknown>) => {
    // Your tool logic here
    return result;
  }
});
```

### 2. Update Foundry system prompt to include tool descriptions:

In `backend/src/routes/chat.ts`, pass tool list to Foundry in system prompt.

### 3. Test via API:

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Authorization: Bearer <token>" \
  -d '{
    "messages": [
      {"role": "user", "content": "Use my_tool to do something"}
    ]
  }'
```

## 📚 Additional Resources

- [React Documentation](https://react.dev)
- [Vite Guide](https://vitejs.dev)
- [Express.js](https://expressjs.com)
- [Azure Container Apps](https://learn.microsoft.com/azure/container-apps)
- [Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps)
- [MSAL.js](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [Azure Foundry](https://learn.microsoft.com/azure/ai/foundry)

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please submit pull requests to main branch.

---

**Next Steps:**
1. Configure local `.env` files
2. Run `npm install` in both directories
3. Start backend: `npm run dev` (in `build/backend`)
4. Start frontend: `npm run dev` (in `build/frontend`)
5. Open browser to `http://localhost:3000`
