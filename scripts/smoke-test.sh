#!/usr/bin/env bash

set -e

RG="${1:-rg-family-ai-hub}"
FRONTEND_APP="${FRONTEND_APP:-frontend-family-hub}"
ACA_ENV="${ACA_ENV:-env-family-hub}"
CUSTOM_DOMAIN="${CUSTOM_DOMAIN:-hub.kisbyfamily.com}"

echo "🔍 Running smoke test for resource group: $RG"
echo "   Frontend app: $FRONTEND_APP"
echo "   ACA environment: $ACA_ENV"
echo "   Custom domain: $CUSTOM_DOMAIN"
echo "---------------------------------------------"

pass() { echo "   ✔ PASS: $1"; }
fail() { echo "   ❌ FAIL: $1"; exit 1; }
echo "1️⃣  Checking resource group..."
if az group show -n "$RG" &>/dev/null; then
  pass "Resource group exists"
else
  fail "Resource group does NOT exist"
fi
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
echo "5️⃣  Checking ACA environment identity..."
ACA_IDENTITY=$(az containerapp env show -g "$RG" -n "$ACA_ENV" --query "identity.type" -o tsv)

[[ "$ACA_IDENTITY" == "SystemAssigned" ]] && pass "ACA environment identity enabled" || fail "ACA environment identity missing"
echo "6️⃣  Checking diagnostic settings..."

SKIP_DIAGNOSTICS=(
  "log-family-hub"      # Is the diagnostics destination, not a source
  "stgfamilyhubcore"    # Storage accounts don't support diagnostic categories cleanly
  "stgfamilyhubdigest"  # Storage accounts don't support diagnostic categories cleanly
  "managedCertificates" # Managed certificates don't support diagnostic settings
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
echo "7️⃣  Checking current frontend and backend container apps..."

FRONTEND_EXISTS=$(az containerapp show -g "$RG" -n "$FRONTEND_APP" --query name -o tsv 2>/dev/null || true)
[[ "$FRONTEND_EXISTS" == "$FRONTEND_APP" ]] && pass "Frontend container app exists" || fail "Frontend container app missing"

BACKEND_EXISTS=$(az containerapp show -g "$RG" -n "backend-family-hub" --query name -o tsv 2>/dev/null || true)
[[ "$BACKEND_EXISTS" == "backend-family-hub" ]] && pass "Backend container app exists" || fail "Backend container app missing"

echo "8️⃣  Checking frontend reachability..."
FRONTEND_FQDN=$(az containerapp show -g "$RG" -n "$FRONTEND_APP" --query "properties.configuration.ingress.fqdn" -o tsv)
FRONTEND_STATE=$(az containerapp show -g "$RG" -n "$FRONTEND_APP" --query "properties.runningStatus" -o tsv)
[[ -n "$FRONTEND_FQDN" && "$FRONTEND_FQDN" != "null" ]] && pass "Frontend ingress FQDN exists: $FRONTEND_FQDN" || fail "Frontend ingress FQDN missing"
[[ "$FRONTEND_STATE" == "Running" ]] && pass "Frontend app is running" || fail "Frontend app not running (status: $FRONTEND_STATE)"

if curl -fsS -I "https://$FRONTEND_FQDN" >/dev/null; then
  pass "Frontend default ACA URL reachable"
else
  fail "Frontend default ACA URL not reachable"
fi

HOSTNAME_BOUND=$(az containerapp hostname list -g "$RG" -n "$FRONTEND_APP" --query "[?name=='$CUSTOM_DOMAIN'] | length(@)" -o tsv)
[[ "$HOSTNAME_BOUND" -ge 1 ]] && pass "Custom hostname bound to frontend app" || fail "Custom hostname NOT bound to frontend app"

if dig +short "$CUSTOM_DOMAIN" | grep -q .; then
  pass "Custom domain resolves in DNS"
else
  fail "Custom domain does not resolve"
fi

CERT_FOUND=$(az containerapp env certificate list -g "$RG" -n "$ACA_ENV" --query "[?contains(properties.subjectName, '$CUSTOM_DOMAIN')] | length(@)" -o tsv)
[[ "$CERT_FOUND" -ge 1 ]] && pass "Managed certificate exists for custom domain" || fail "Managed certificate missing for custom domain"

echo "---------------------------------------------"
echo "🎉 ALL CHECKS PASSED — Infrastructure is healthy"