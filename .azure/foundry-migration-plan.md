# Family Hub: Foundry Migration Deployment Plan

**Status:** 🔄 Planning  
**Date Created:** May 5, 2026  
**Last Updated:** May 5, 2026

---

## Executive Summary

Migrate **Family Hub** from standalone **Azure OpenAI** (single model: gpt-4.1-mini) to **Microsoft Foundry** (50+ models + agentic capabilities + future-proof architecture).

### Why Foundry?
- **Multi-model access**: GPT-4o, Claude, Llama, Mistral, Grok, Phi, etc.
- **Future-proofed**: Switch models without infrastructure changes
- **Cost optimized**: Pay-per-token instead of provisioned units
- **Agent-native**: Direct support for autonomous workflows
- **Compliance**: Better audit trails and governance
- **Reliability**: Regional failover and circuit breaker patterns

---

## Phase 1: Infrastructure Analysis & Architecture Decision

### 1.1 Current State Analysis

| Component | Current | Status |
|-----------|---------|--------|
| Model Provider | Azure OpenAI (gpt-4.1-mini) | Standalone |
| API Model | `Microsoft.CognitiveServices/accounts` | Single-purpose |
| Deployment | Manual model deployment | Static |
| Diagnostics | ✅ Wired to Log Analytics | Operational |
| Authentication | Entra ID (EasyAuth in ACA) | Secure |
| Container App | OpenWebUI (open-source) | Working |

### 1.2 Foundry Architecture Decision

**OPTION A: Hybrid (Recommended)**
- Deploy Microsoft Foundry resource + project
- Keep OpenWebUI container running
- Configure OpenWebUI to proxy requests to Foundry API
- Allows gradual migration to fully agentic workflows

**OPTION B: Full Agent Replacement**
- Deploy Foundry-native hosted agent
- Replace OpenWebUI with Microsoft Agent Framework app
- Full agentic capabilities from day 1
- Requires React/Vue frontend for chat UI

**SELECTED: OPTION A (Hybrid)**
- Rationale: Minimal disruption, leverage existing OpenWebUI UI, gradual agent adoption possible

### 1.3 Required Azure Resources

| Resource | Current | New | Purpose |
|----------|---------|-----|---------|
| Cognitive Services Account | Azure OpenAI (S0) |❌ Remove | Replaced by Foundry |
| AI Services Multi-Service | ❌ None | ✅ Create | Foundry core resource |
| Foundry Project | ❌ None | ✅ Create | Model deployments + connections |
| Key Vault Secret | aoai-api-key | foundry-api-key | Foundry endpoint key |
| Environment Variable | OPENAI_API_KEY | FOUNDRY_API_KEY | Container environment |

---

## Phase 2: Infrastructure Code Changes (Bicep)

### 2.1 Files to Delete
```
infra/modules/openAi.bicep  ← Remove entirely
```

### 2.2 Files to Create
```
infra/modules/foundryResource.bicep    ← AI Services multi-service account
infra/modules/foundryProject.bicep     ← Foundry project + connections
```

### 2.3 Files to Modify
```
infra/main.bicep                       ← Update module chain, remove OpenAI refs
infra/parameters/main.parameters.json ← Add foundry-specific params
.github/workflows/deploy-infra.yml     ← Update deployment steps, add model setup
```

### 2.4 Module Specifications

#### `infra/modules/foundryResource.bicep`

Core AI Services multi-service resource (back-end container for all Foundry projects).

**Parameters:**
- `location`: Region (swedencentral)
- `resourceName`: e.g., `ai-family-hub`
- `skuName`: Default `S0` (standard tier)
- `logAnalyticsWorkspaceId`: For diagnostics

**Outputs:**
- `resourceId`: Full resource ID
- `endpoint`: HTTPS endpoint
- `resourceName`: Resource name

**Diagnostics:**
- Logs: Audit, RequestResponse, Trace (enabled)
- Metrics: AllMetrics (enabled)
- Destination: Log Analytics workspace

#### `infra/modules/foundryProject.bicep`

Project within the AI Services resource. Contains models, connections, system prompts.

**Parameters:**
- `aiServicesResourceId`: Parent AI Services account
- `projectName`: e.g., `project-family-hub`
- `location`: Region
- `description`: "Family Hub AI Services Project"
- `keyVaultName`: For storing API keys (optional, can use direct injection)
- `logAnalyticsWorkspaceId`: For agent telemetry

**Outputs:**
- `projectId`: Unique identifier
- `projectEndpoint`: API endpoint for agents/models

**Nested Resources:**
- Project resource itself
- Model deployments (GPT-4o, Claude, etc. — configurable)
- Project connections to Key Vault

### 2.5 Parameter Defaults (`infra/parameters/main.parameters.json`)

```json
{
  "foundryResourceName": { "value": "ai-family-hub" },
  "foundryProjectName": { "value": "project-family-hub" },
  "foundryDefaultModel": { "value": "gpt-4o" },
  "foundryDefaultModelVersion": { "value": "2024-12-19" },
  "foundrySearchEnabled": { "value": false }
}
```

---

## Phase 3: OpenWebUI Container Integration

### 3.1 Integration Pattern

OpenWebUI natively supports OpenAI-compatible APIs. We'll configure it to proxy requests to Foundry API.

**Container Environment Variables (new/changed):**
```bash
OPENAI_API_BASE_URL=https://family-hub-swedencentral.openai.azure.com/openai/deployments/gpt-4o/
OPENAI_API_KEY=${FOUNDRY_API_KEY}
OPENAI_API_VERSION=2024-12-01-preview
```

### 3.2 Foundry API Key Injection

Store Foundry API key in Key Vault, inject into OpenWebUI via EasyAuth secret reference.

**Key Vault Configuration:**
```
Secret name: foundry-api-key
Value: <Foundry project API key>
Reference in ACA: @Microsoft.KeyVault(SecretUri=https://kv-family-hub.vault.azure.net/secrets/foundry-api-key/)
```

---

## Phase 4: Deployment Approach (Two-Phase)

### 4.1 Phase 1 Deployment (Base Infrastructure)

Deploys Foundry resource + project, but NOT the OpenWebUI revision update yet.

```bash
az deployment group create \
  --resource-group rg-family-ai-hub \
  --template-file infra/main.bicep \
  --parameters infra/parameters/main.parameters.json \
  --parameters deployWebUI=false
```

**What gets created:**
- AI Services account (ai-family-hub)
- Foundry project (project-family-hub)
- Model deployments (gpt-4o, claude-3.5)
- Diagnostic settings
- Key Vault secrets

**What remains:**
- Existing OpenWebUI container (still uses old Azure OpenAI reference)

### 4.2 Phase 2 Deployment (WebUI Update)

Updates OpenWebUI container with Foundry endpoint configuration.

```bash
az deployment group create \
  --resource-group rg-family-ai-hub \
  --template-file infra/main.bicep \
  --parameters infra/parameters/main.parameters.json \
  --parameters deployWebUI=true \
  --parameters foundryApiKeyRef="@Microsoft.KeyVault(SecretUri=https://kv-family-hub.vault.azure.net/secrets/foundry-api-key/)"
```

**What changes:**
- Container App environment variables updated
- WebUI container revision restarted
- OpenWebUI now proxies through Foundry API

---

## Dependencies & Prerequisites

### Azure Resources
- ✅ Existing: Resource group, Key Vault, Container App Environment, Log Analytics
- ✅ Existing: Entra app registration with redirect URI
- ❌ New: AI Services account (Foundry resource)
- ❌ New: Foundry project

### Permissions
- ✅ Existing: Subscription contributor role
- ✅ Existing: Key Vault Admin role
- ✅ Existing: Container App role

### Configuration
- ℹ️ **Foundry API Key**: Must be generated in Foundry portal after project creation
- ℹ️ **OpenWebUI Configuration**: Environment variables updated during deployment
- ℹ️ **DNS**: No changes needed (hub.kisbyfamily.com remains same)

---

## Rollback Plan

If Foundry integration fails:

1. **Quick Rollback**: Revert OpenWebUI container to previous version
   ```bash
   az containerapp revision restart \
     --resource-group rg-family-ai-hub \
     --name webui-family-hub \
     --revision <previous-revision-id>
   ```

2. **Full Rollback**: Re-deploy OpenAI module
   ```bash
   git checkout HEAD~1 infra/modules/openAi.bicep
   az deployment group create ... --template-file infra/main.bicep
   ```

---

## Success Criteria

| Criterion | Check |
|-----------|-------|
| Foundry resource created | `az cognitiveservices account show -n ai-family-hub -g rg-family-ai-hub` |
| Project visible in portal | Navigate to AI Foundry Studio, select project |
| gpt-4o model deployed | `az cognitiveservices account list-models -n ai-family-hub` includes gpt-4o |
| OpenWebUI connected | curl `/v1/models` on OpenWebUI health endpoint returns Foundry models |
| Chat works end-to-end | Ask OpenWebUI a question, verify gpt-4o response |
| Diagnostics enabled | Log Analytics shows Foundry telemetry |
| Smoke tests pass | Run compliance validation script |

---

## Timeline

| Phase | Task | Duration | Status |
|-------|------|----------|--------|
| 1 | Create Bicep modules | 1 hour | ⏳ Pending approval |
| 2 | Update main.bicep + parameters | 30 min | ⏳ Pending approval |
| 3 | Update GitHub Actions | 15 min | ⏳ Pending approval |
| 4 | Phase 1 deployment (base) | 10 min | ⏳ Pending approval |
| 5 | Verify Foundry project + API key | 5 min | ⏳ Pending approval |
| 6 | Phase 2 deployment (WebUI update) | 10 min | ⏳ Pending approval |
| 7 | Smoke test validation | 5 min | ⏳ Pending approval |

**Total**: ~2 hours

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Foundry quota exceeded | Medium | Check regional quota before deploy; request increase if needed |
| OpenWebUI doesn't recognize Foundry API format | Medium | Foundry has OpenAI-compatible endpoint; test locally first |
| API key propagation delay | Low | Store in Key Vault, allow ~2 min for Key Vault replication |
| Custom domain TLS already configured | Low | No changes needed; certificate binding remains in place |
| Entra authentication bypass | Low | Entra auth happens at ACA layer, not API layer — unaffected |

---

## Decisions & Approvals

**Architecture Decision**: Hybrid (Keep OpenWebUI, proxy through Foundry API) ← **AWAITING USER APPROVAL**

### Questions for User

1. **Model Preferences**: Which models should be deployed initially?
   - GPT-4o (latest, most capable)
   - Claude 3.5 Sonnet (good balance)
   - Llama 3.1 (open source option)
   - All three?

2. **Future Agent Adoption**: Should we prepare for Foundry-native agents later?
   - Yes (add `.foundry/agent-metadata.yaml` structure)
   - No (keep OpenWebUI indefinitely)

3. **Cost Model**: Any budget constraints?
   - Pay-per-token (Foundry default)
   - Provisioned capacity (Flex Consumption)?

---

## Approval Checklist

- [ ] User approves architecture (Hybrid)
- [ ] User confirms model list
- [ ] User confirms timeline is acceptable
- [ ] No blocking dependencies
- [ ] Ready to proceed with Phase 2 execution

---

## Appendix: Foundry Concepts

### AI Services Account vs. Foundry Project

| Aspect | AI Services Account | Foundry Project |
|--------|-------------------|-----------------|
| **Tier** | Parent resource | Child resource |
| **Purpose** | Billing + identity container | Models + agents + connections |
| **Creates** | One per deployment | Many per account possible |
| **API** | Management plane | Data plane (models, invoke) |

### Model Deployment in Foundry

Models are deployed as connections/endpoints within the project:
- **Deployment name**: Human-friendly identifier (e.g., `gpt-4o-deployment`)
- **Model identifier**: Full model ID (e.g., `gpt-4o-2024-11-20`)
- **SKU**: Varies by model (Standard, Premium)
- **Capacity**: Tokens-per-minute (TPM) quota

### Foundry API Key

- Generated per project
- Scoped to that project only
- Can be regenerated (invalidates old key)
- Should be rotated periodically (best practice)

---

**Next Steps**: 
1. User reviews this plan and answers questions in Approval Checklist
2. Upon approval, proceed to Phase 2: Create Bicep modules + update infrastructure code
3. Upon completion, hand off to azure-validate for preflight checks
4. Then hand off to azure-deploy for execution
