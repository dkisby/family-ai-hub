#!/usr/bin/env bash

set -e

RG="$1"

if [ -z "$RG" ]; then
  echo "❌ ERROR: No resource group supplied."
  echo "Usage: bash smoke-test.sh <resource-group-name>"
  exit 1
fi

echo "🔍 Running smoke test for resource group: $RG"
echo "---------------------------------------------"

pass() { echo "   ✔ PASS: $1"; }
fail() { echo "   ❌ FAIL: $1"; exit 1; }

# 1. Resource group exists
echo "1️⃣  Checking resource group..."
if az group show -n "$RG" &>/dev/null; then
  pass "Resource group exists"
else
  fail "Resource group does NOT exist"
fi

# 2. List resources
echo "2️⃣  Checking core resources..."
RESOURCES=$(az resource list -g "$RG" --query "[].type" -o tsv)

check_resource() {
  if echo "$RESOURCES" | grep -q "$1"; then
    pass "$2"
  else
    fail "$2 missing"
  fi
}

check_resource "Microsoft.OperationalInsights/workspaces" "Log Analytics Workspace"
check_resource "Microsoft.KeyVault/vaults" "Key Vault"
check_resource "Microsoft.Storage/storageAccounts" "Storage Accounts"
check_resource "Microsoft.ContainerRegistry/registries" "Container Registry"
check_resource "Microsoft.App/managedEnvironments" "ACA Environment"
check_resource "Microsoft.CognitiveServices/accounts" "Foundry AI Services Resource"

# 3. ACR identity + admin disabled
echo "3️⃣  Checking ACR configuration..."
ACR_NAME=$(az acr list -g "$RG" --query "[0].name" -o tsv)

ADMIN=$(az acr show -n "$ACR_NAME" --query "adminUserEnabled" -o tsv)
[[ "$ADMIN" == "false" ]] && pass "ACR admin disabled" || fail "ACR admin ENABLED"

PRINCIPAL_ID=$(az acr show -n "$ACR_NAME" --query "identity.principalId" -o tsv)
if [[ -n "$PRINCIPAL_ID" && "$PRINCIPAL_ID" != "null" ]]; then
  pass "ACR identity enabled"
else
  fail "ACR identity missing"
fi

# 4. Storage accounts private
echo "4️⃣  Checking storage account network rules..."
STORAGE_ACCOUNTS=$(az storage account list -g "$RG" --query "[].name" -o tsv)

for ST in $STORAGE_ACCOUNTS; do
  ACTION=$(az storage account show -n "$ST" -g "$RG" --query "networkRuleSet.defaultAction" -o tsv)
  if [[ "$ACTION" == "Deny" ]]; then
    pass "Storage account $ST is private"
  else
    fail "Storage account $ST is PUBLIC"
  fi
done

# 5. ACA environment identity
echo "5️⃣  Checking ACA environment identity..."
ACA_ENV=$(az containerapp env list -g "$RG" --query "[0].name" -o tsv)
ACA_IDENTITY=$(az containerapp env show -g "$RG" -n "$ACA_ENV" --query "identity.type" -o tsv)

[[ "$ACA_IDENTITY" == "SystemAssigned" ]] && pass "ACA environment identity enabled" || fail "ACA environment identity missing"

# 6. Diagnostic settings
echo "6️⃣  Checking diagnostic settings..."

SKIP_DIAGNOSTICS=(
  "log-family-hub"      # Is the diagnostics destination, not a source
  "stgfamilyhubcore"    # Storage accounts don't support diagnostic categories cleanly
  "stgfamilyhubdigest"  # Storage accounts don't support diagnostic categories cleanly
  "webui-family-hub"    # Container Apps diagnostics not supported
  "id-webui-family-hub" # Managed identities don't support diagnostic settings
  "managedCertificates" # Managed certificates don't support diagnostic settings
  "aoai-family-hub"     # Deprecated: migrated to Foundry (ai-family-hub)
)

for ID in $(az resource list -g "$RG" --query "[].id" -o tsv); do
  BASENAME=$(basename "$ID")

  SKIP=false
  for skip_item in "${SKIP_DIAGNOSTICS[@]}"; do
    if [[ "$ID" == *"$skip_item"* ]]; then
      SKIP=true
      break
    fi
  done

  if [ "$SKIP" = true ]; then
    pass "Skipping diagnostics check for $BASENAME"
    continue
  fi

  DIAG_COUNT=$(az monitor diagnostic-settings list \
    --resource "$ID" \
    --query "length(@)" -o tsv)

  if [[ "$DIAG_COUNT" -gt 0 ]]; then
    pass "Diagnostics enabled for $BASENAME"
  else
    fail "Diagnostics missing for $BASENAME"
  fi
done

# 7. Container Apps
echo "7️⃣  Checking Container Apps..."

check_resource "Microsoft.App/containerApps" "WebUI Container App"

WEBUI_NAME=$(az containerapp list -g "$RG" --query "[0].name" -o tsv)

# Identity
WEBUI_IDENTITY=$(az containerapp show -g "$RG" -n "$WEBUI_NAME" --query "identity.type" -o tsv)
[[ "$WEBUI_IDENTITY" == "UserAssigned" ]] && pass "WebUI identity enabled" || fail "WebUI identity missing"

# External ingress enabled
WEBUI_INGRESS=$(az containerapp show -g "$RG" -n "$WEBUI_NAME" --query "properties.configuration.ingress.external" -o tsv)
[[ "$WEBUI_INGRESS" == "true" ]] && pass "WebUI ingress is external" || fail "WebUI ingress is not external"

# Auth enabled
WEBUI_AUTH=$(az containerapp auth show -g "$RG" -n "$WEBUI_NAME" --query "platform.enabled" -o tsv 2>/dev/null || echo "false")
[[ "$WEBUI_AUTH" == "true" ]] && pass "WebUI auth enabled" || fail "WebUI auth not enabled"

# ACR pull via managed identity
WEBUI_REGISTRY=$(az containerapp show -g "$RG" -n "$WEBUI_NAME" --query "properties.configuration.registries[0].identity" -o tsv)
[[ -n "$WEBUI_REGISTRY" && "$WEBUI_REGISTRY" != "null" ]] && pass "WebUI pulling from ACR via managed identity" || fail "WebUI not using managed identity for ACR"

# ACR role assignment - WebUI user identity has AcrPull
IDENTITY_PRINCIPAL=$(az identity show --resource-group "$RG" --name "id-webui-family-hub" --query principalId -o tsv)
ACR_ID=$(az acr show -n "$ACR_NAME" -g "$RG" --query "id" -o tsv)
ACR_PULL_ROLE=$(az role assignment list --assignee "$IDENTITY_PRINCIPAL" --scope "$ACR_ID" --query "[?roleDefinitionName=='AcrPull'].roleDefinitionName" -o tsv)
[[ "$ACR_PULL_ROLE" == "AcrPull" ]] && pass "WebUI has AcrPull role on ACR" || fail "WebUI missing AcrPull role on ACR"

echo "---------------------------------------------"
echo "🎉 ALL CHECKS PASSED — Infrastructure is healthy"