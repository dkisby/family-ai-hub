# Family AI Hub – Infrastructure

This repository contains the Azure infrastructure for the Family AI Hub.

## Components

- Azure Container Apps (Open WebUI + Jobs)
- Azure Container Registry
- Azure Key Vault
- Azure Blob Storage (private + static website)
- Log Analytics Workspace
- Optional VNET + Private Endpoints
- Cloudflare (DNS + WAF + TLS)

## Deployment

Infrastructure is deployed using:

- Bicep (modular)
- GitHub Actions (OIDC → Azure)
- Resource group: `rg-family-ai-hub`

## Structure

infra/
  main.bicep
  modules/
  parameters/
.github/
  workflows/

## Next Steps

- Deploy ACA environment
- Deploy Open WebUI
- Deploy Daily Digest job
- Add Cloudflare DNS + WAF
