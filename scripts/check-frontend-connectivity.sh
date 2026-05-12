#!/usr/bin/env bash

set -euo pipefail

RG="${RG:-rg-family-ai-hub}"
FRONTEND_APP="${FRONTEND_APP:-frontend-family-hub}"
ACA_ENV="${ACA_ENV:-env-family-hub}"
CUSTOM_DOMAIN="${CUSTOM_DOMAIN:-hub.kisbyfamily.com}"

echo "Checking frontend connectivity"
echo "  Resource group: $RG"
echo "  Frontend app:   $FRONTEND_APP"
echo "  ACA env:        $ACA_ENV"
echo "  Custom domain:  $CUSTOM_DOMAIN"
echo

echo "1) Frontend app state + default ingress FQDN"
az containerapp show \
  --name "$FRONTEND_APP" \
  --resource-group "$RG" \
  --query "{state:properties.runningStatus,provisioningState:properties.provisioningState,fqdn:properties.configuration.ingress.fqdn}" \
  -o yaml

FQDN=$(az containerapp show --name "$FRONTEND_APP" --resource-group "$RG" --query "properties.configuration.ingress.fqdn" -o tsv)
echo

echo "2) Default ACA URL reachability"
curl -I "https://$FQDN" || true
echo

echo "3) Hostname bindings"
az containerapp hostname list \
  --name "$FRONTEND_APP" \
  --resource-group "$RG" \
  -o table

echo
echo "4) DNS resolution for custom domain"
dig +short "$CUSTOM_DOMAIN"
echo

echo "5) Managed certificates in ACA environment"
az containerapp env certificate list \
  --name "$ACA_ENV" \
  --resource-group "$RG" \
  -o table

echo
echo "Done. If step 2 works but custom domain fails, this is DNS/hostname binding, not app/auth."