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

ACR_NAME="acrfamilyhub"
ACR_ID=$(az acr show -n "$ACR_NAME" -g "$RG" --query id -o tsv)

# Special-case check for ACR (ACR requires full resource ID)
ACR_DIAG_COUNT=$(az monitor diagnostic-settings list \
  --resource "$ACR_ID" \
  --query "length(@)" -o tsv)

if [[ "$ACR_DIAG_COUNT" -gt 0 ]]; then
  pass "Diagnostics enabled for $ACR_NAME"
else
  fail "Diagnostics missing for $ACR_NAME"
fi

# Generic check for all other resources
for ID in $(az resource list -g "$RG" --query "[].id" -o tsv); do
  BASENAME=$(basename "$ID")

    # Skip ACR (checked above)
    if [[ "$BASENAME" == "$ACR_NAME" ]]; then
    continue
    fi

    # Skip Log Analytics Workspace (it cannot have diag settings)
    if [[ "$BASENAME" == "log-family-hub" ]]; then
    pass "Skipping diagnostics check for Log Analytics Workspace ($BASENAME)"
    continue
    fi

    DIAG=$(az monitor diagnostic-settings list --resource "$ID" --query "value" -o tsv)

    if [[ -n "$DIAG" ]]; then
    pass "Diagnostics enabled for $BASENAME"
    else
    fail "Diagnostics missing for $BASENAME"
    fi
done


echo "---------------------------------------------"
echo "🎉 ALL CHECKS PASSED — Infrastructure is healthy"
