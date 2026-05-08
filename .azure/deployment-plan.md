# Family Hub ChatUI — Deployment Plan

**Project Mode:** MODERNIZE (Replace WebUI with custom React SPA + Backend API)  
**Architecture:** React SPA (Static Web App or ACA) + Backend API (ACA) + Foundry + Entra Auth  
**Created:** 8 May 2026  

---

## Phase 1: Planning ✓

### Step 0: Specialized Technology Check
- ✅ Entra authentication (native Azure support)
- ✅ Foundry/Azure OpenAI integration (azure-prepare will handle)
- ✅ React SPA + Backend API (standard azure-prepare recipe)
- ⚠️ MCP server integration — custom implementation required (not in standard recipes)

**Decision:** USE azure-prepare for main infrastructure; handle MCP tools separately.

---

### Step 1: Workspace Analysis

**Mode:** MODERNIZE  
**Current State:**  
- Foundry resource deployed ✅
- Key Vault with secrets ✅
- Container App environment (ACA) ✅
- WebUI container app (TO BE REMOVED) ❌
- Entra app registration (exists, reuse) ✅

**Plan:**  
1. Keep: Foundry resource, Key Vault, ACA environment, Entra app registration
2. Remove: webui-family-hub container app, all OpenWebUI configuration
3. Add: React SPA (Static Web App OR ACA), backend API (ACA), chat UI component
4. New CI/CD: GitHub Actions for React build + backend image push

---

### Step 2: Requirements

| Category | Details |
|----------|---------|
| **Deployment Target** | Azure Container Apps (React SPA as Static App or ACA; Backend API as ACA) |
| **Auth** | Entra ID with EasyAuth (reuse existing aadClientId/aadClientSecret/tenantId) |
| **AI/LLM** | Foundry (gpt-4.1-mini) — `https://ai-family-hub.openai.azure.com` |
| **Tools/Agents** | MCP server framework (TBD: Python/Node.js, deployed where?) |
| **Frontend** | React 18+, TypeScript, Tailwind CSS, chat UI component |
| **Backend** | Node.js/Express API, TypeScript, tool dispatch logic |
| **Database** | Optional: Azure Cosmos DB for chat history, or in-memory |
| **Scale** | Dev/test: small; production-ready architecture |
| **Budget** | Minimize: Static Web App tier (free) + Basic ACA + Foundry model |

---

### Step 3: Architecture Decision

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT (Browser)                                            │
├─────────────────────────────────────────────────────────────┤
│ React SPA (Static Web App)                                  │
│ • Chat UI component (OpenAI-like)                           │
│ • Entra auth (via EasyAuth redirect)                        │
│ • Call backend API                                          │
└─────────────────────────┬──────────────────────────────────┘
                          │ HTTPS
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend API (ACA Container)                                 │
│ • Node.js/Express + TypeScript                              │
│ • Receives chat messages                                    │
│ • Dispatch to Foundry LLM                                   │
│ • Execute tools via MCP                                     │
│ • Stream responses back to frontend                         │
└──────────────┬──────────────────────────┬──────────────────┘
               │                          │
      ┌─────────────────┐      ┌─────────────────────┐
      │ Azure Foundry   │      │ MCP Tool Server     │
      │ gpt-4.1-mini    │      │ (localhost or ACA)  │
      └─────────────────┘      └─────────────────────┘
```

**Frontend Hosting Options:**
- Option A: **Azure Static Web App (SWA)** — Recommended  
  - Free tier available
  - Free SSL
  - Built-in staging environments
  - Native integration with Entra
- Option B: Azure Container Apps (ACA)  
  - More orchestration needed
  - Overkill for static React site
  - **Not recommended for this project**

**Decision:** Use **Azure Static Web App** for frontend.

---

### Step 4: Recipe Selection

**Base Recipe:** Custom multi-tier
- Tier 1: Static Web App (React SPA)
- Tier 2: Container App (Backend API)
- Tier 3: Existing Foundry resource
- Tools: MCP server integration (out-of-scope for azure-prepare; handle post-deployment)

---

### Step 5: Infrastructure Components

| Component | Technology | Bicep Module | Status |
|-----------|-----------|--------------|--------|
| Frontend Hosting | Static Web App | `swa.bicep` | NEW |
| Backend API | Container App | `acaBackendAPI.bicep` | NEW |
| ACA Environment | Existing | Reuse | ✅ |
| Foundry Resource | Existing | Reuse | ✅ |
| Key Vault | Existing | Reuse | ✅ |
| Entra App Reg | Existing | Reference | ✅ |
| API Key Rotation | (Optional) | N/A | DEFER |

**Bicep Structure:**
```
infra/
├── main.bicep                    (orchestrator)
├── modules/
│   ├── foundryResource.bicep     (EXISTING)
│   ├── acaEnvironment.bicep      (EXISTING)
│   ├── acaBackendAPI.bicep       (NEW)
│   ├── staticWebApp.bicep        (NEW)
│   └── ...
└── parameters.json               (updated)
```

---

### Step 6: Source Code Structure

```
/build/                            (NEW directory)
├── frontend/
│   ├── package.json               (React + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   └── ChatUI.tsx         (OpenAI-style chat component)
│   │   ├── pages/
│   │   │   └── Chat.tsx
│   │   ├── services/
│   │   │   └── api.ts             (Backend API client)
│   │   ├── auth/
│   │   │   └── authConfig.ts      (Entra MSAL config)
│   │   └── App.tsx
│   ├── public/
│   ├── vite.config.ts
│   ├── staticwebapp.config.json   (SWA routing)
│   └── Dockerfile                 (optional, if SPA needs custom build)
│
├── backend/
│   ├── package.json               (Express + TypeScript)
│   ├── src/
│   │   ├── server.ts              (Express app)
│   │   ├── routes/
│   │   │   ├── chat.ts            (POST /api/chat)
│   │   │   └── health.ts          (GET /health)
│   │   ├── services/
│   │   │   ├── foundry.ts         (Foundry API client)
│   │   │   ├── tools.ts           (MCP tool dispatch)
│   │   │   └── auth.ts            (Entra token validation)
│   │   └── middleware/
│   │       └── auth.ts            (JWT/Bearer validation)
│   ├── Dockerfile                 (multi-stage build)
│   └── .dockerignore
│
├── tools/                          (MCP server template)
│   ├── package.json               (Node.js MCP SDK)
│   ├── src/
│   │   ├── server.ts              (MCP server)
│   │   ├── tools/
│   │   │   ├── calculator.ts      (Example: math tools)
│   │   │   └── search.ts          (Example: web search)
│   │   └── index.ts
│   └── Dockerfile
│
└── infra/                          (EXISTING, updated)
    ├── main.bicep                 (updated)
    ├── modules/
    │   ├── staticWebApp.bicep      (NEW)
    │   ├── acaBackendAPI.bicep     (NEW)
    │   └── foundryResource.bicep   (EXISTING)
    └── parameters.json
```

---

### Step 7: Deployment Phases

| Phase | Component | Tools | Status |
|-------|-----------|-------|--------|
| 1 | Bicep validation + RBAC check | azure-validate | PENDING |
| 2 | Deploy infrastructure (Bicep → Azure) | azure-deploy (azd up) | PENDING |
| 3 | Build React frontend | npm run build | MANUAL post-deploy |
| 4 | Build & push backend image | docker build + ACR push | GitHub Actions |
| 5 | Deploy backend image | ACA update | GitHub Actions |
| 6 | Configure SWA routing | staticwebapp.config.json | PART OF SWA deploy |
| 7 | Enable Entra auth on SPA | SWA provider config | PART OF SWA deploy |
| 8 | (Optional) Deploy MCP server | Docker + ACA or standalone | MANUAL or GH Actions |

---

### Step 8: CI/CD Pipeline (GitHub Actions)

**Workflow:** `.github/workflows/deploy-react-api.yml`

```yaml
Triggers: Push to main branch / PR

Jobs:
  - Lint & Test (React + Backend)
  - Build React SPA → Static Web App build artifact
  - Build Backend Docker image → Push to ACR
  - Deploy SWA (Azure Static Web App Action)
  - Deploy ACA backend (az containerapp update)
```

---

### Step 9: Configuration & Secrets

**GitHub Secrets (to create):**
- `AZURE_SUBSCRIPTION_ID` (existing or new)
- `AZURE_RESOURCE_GROUP` = `rg-family-ai-hub`
- `AZURE_SWA_NAME` = `swa-chatui-hub` (NEW)
- `AZURE_ACA_NAME` = `backend-family-hub` (NEW)
- `AZURE_ACR_LOGIN_SERVER` = ACR name (existing)
- `ENTRA_TENANT_ID` (existing)
- `ENTRA_CLIENT_ID` (existing aadClientId)
- `ENTRA_CLIENT_SECRET` (existing aadClientSecret)
- `FOUNDRY_API_KEY` (from Key Vault)
- `FOUNDRY_ENDPOINT` = `https://ai-family-hub.openai.azure.com`

---

### Step 10: MCP Tool Server Strategy

**Question:** Will MCP server run in same ACA pod as backend API, or separate?

**Options:**

1. **In-process (backend talks directly to tools)**
   - MCP tools defined as backend functions
   - No separate MCP server
   - Simpler, lower latency
   - **Recommended for MVP**

2. **Separate ACA container**
   - Backend calls MCP server via HTTP/stdio
   - Cleaner separation
   - More complex, but scalable
   - **Recommended for production**

3. **Serverless (Azure Functions)**
   - MCP tools as Azure Functions
   - Consume via Function SDK
   - Best for serverless-first arch
   - **Not recommended here**

**Decision for This Project:** Start with **Option 1** (in-process tools); refactor to **Option 2** later if needed.

**Tool Examples (in-process):**
- Calculator tool (math expressions)
- Search tool (web search via API)
- Database queries (if chat history stored in DB)
- Custom domain logic tools

---

## Phase 2: Approval Checklist

**User to verify YES on:**
- [ ] Architecture: React SPA (Static Web App) + Node.js Backend API (ACA) + Foundry + Entra
- [ ] Directory: Create everything in `/build/` folder
- [ ] Removal: Delete all WebUI-related container apps and config
- [ ] Frontend: Use React 18 + TypeScript + Tailwind + Vite
- [ ] Backend: Node.js + Express + TypeScript
- [ ] Chat UI: OpenAI-style component (streaming messages, tool use)
- [ ] Auth: Reuse existing Entra app registration + EasyAuth
- [ ] Foundry: Connect to existing `ai-family-hub` resource
- [ ] Tools: Start with in-process MCP-style tool dispatch (expand later)
- [ ] CI/CD: GitHub Actions (React build + Backend push to ACR + Deploy)
- [ ] Bicep: Create `swa.bicep` + `acaBackendAPI.bicep` modules
- [ ] Delete: Remove all OpenWebUI files after SWA/API ready

---

## Phase 3: Execution Steps

**Once approved:**

1. Create deployment structure under `/build/`
2. Generate React SPA starter (Vite + React 18 + TypeScript)
3. Generate Backend API starter (Express + TypeScript)
4. Create chat UI component with streaming support
5. Create Bicep modules (SWA + Backend API)
6. Create GitHub Actions CI/CD workflow
7. Run azure-validate
8. Run azure-deploy (azd up)
9. Verify deployment
10. Remove WebUI-related resources
11. Test end-to-end: Chat in UI → Backend → Foundry → Response

---

## Notes

- **Foundry Endpoint:** `https://ai-family-hub.openai.azure.com` (NO `/openai` suffix)
- **API Key:** Stored in Key Vault as `foundry-api-key`
- **Entra Config:** Reuse existing `aadClientId`, `aadClientSecret`, `tenantId`
- **ACA Environment:** Reuse existing `env-family-ai-hub`
- **Clean-up:** After SWA + API verified working, remove `webui-family-hub` container app
