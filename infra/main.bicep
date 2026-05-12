param location string = resourceGroup().location

@description('Whether to deploy the backend API')
param deployBackendAPI bool = false

@description('Whether to deploy the frontend UI')
param deployFrontendUI bool = false

@description('Backend API container image')
param backendAPIImage string = 'mcr.microsoft.com/k8se/quickstart:latest'

@description('Frontend UI container image')
param frontendUIImage string = 'mcr.microsoft.com/k8se/quickstart:latest'

@description('Foundry default model name')
param foundryDefaultModel string = 'gpt-4.1-mini'

@description('Foundry model version')
param foundryModelVersion string = '2025-04-14'

@description('Enable TLS binding for frontend custom domain. Use false for first run to register hostname, then true to issue and bind managed cert.')
param enableFrontendCustomDomainTls bool = false

var tenantId = tenant().tenantId
var acaEnvName = 'env-family-hub'
var logAnalyticsName = 'log-family-hub'

module logAnalytics './modules/logAnalytics.bicep' = {
  name: 'logAnalytics'
  params: {
    name: logAnalyticsName
    location: location
  }
}

module keyVault './modules/keyVault.bicep' = {
  name: 'keyVault'
  params: {
    name: 'kv-family-hub'
    location: location
    tenantId: tenantId
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
  }
}

resource keyVaultRef 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: 'kv-family-hub'
}

resource laSharedKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVaultRef
  name: 'la-shared-key'
  properties: {
    value: listKeys(resourceId('Microsoft.OperationalInsights/workspaces', logAnalyticsName), '2023-09-01').primarySharedKey
  }
  dependsOn: [logAnalytics]
}

module acr './modules/acr.bicep' = {
  name: 'acr'
  params: {
    name: 'acrfamilyhub'
    location: location
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
  }
}

module acaEnv 'modules/acaEnvironment.bicep' = {
  name: 'acaEnv'
  params: {
    name: acaEnvName
    location: location
    logAnalyticsCustomerId: logAnalytics.outputs.customerId
    logAnalyticsSharedKey: keyVaultRef.getSecret('la-shared-key')
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
  }
}

module backendIdentity './modules/managedIdentity.bicep' = if (deployBackendAPI) {
  name: 'backendIdentity'
  params: {
    name: 'id-backend-family-hub'
    location: location
  }
}

module frontendIdentity './modules/managedIdentity.bicep' = if (deployFrontendUI) {
  name: 'frontendIdentity'
  params: {
    name: 'id-frontend-family-hub'
    location: location
  }
}

module backendAcrPull './modules/acrPullRoleAssignment.bicep' = if (deployBackendAPI) {
  name: 'backendAcrPull'
  params: {
    acrName: 'acrfamilyhub'
    principalId: backendIdentity.outputs.principalId ?? ''
  }
  dependsOn: [acr]
}

module frontendAcrPull './modules/acrPullRoleAssignment.bicep' = if (deployFrontendUI) {
  name: 'frontendAcrPull'
  params: {
    acrName: 'acrfamilyhub'
    principalId: frontendIdentity.outputs.principalId ?? ''
  }
  dependsOn: [acr]
}

module foundryResource './modules/foundryResource.bicep' = {
  name: 'foundryResource'
  params: {
    resourceName: 'ai-family-hub'
    location: location
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
  }
}

module foundryProject './modules/foundryProject.bicep' = {
  name: 'foundryProject'
  params: {
    aiServicesResourceId: foundryResource.outputs.resourceId
    defaultModelName: foundryDefaultModel
    defaultModelVersion: foundryModelVersion
  }
}

module backendAPI './modules/acaBackendAPI.bicep' = if (deployBackendAPI) {
  name: 'backendAPI'
  params: {
    name: 'backend-family-hub'
    location: location
    acaEnvironmentName: acaEnvName
    acrName: 'acrfamilyhub'
    image: backendAPIImage
    identityId: backendIdentity.outputs.identityId ?? ''
    tenantId: tenantId
    foundryEndpoint: foundryResource.outputs.openaiEndpoint
    foundryApiKey: keyVaultRef.getSecret('foundry-api-key')
    acaEnvironmentResourceGroup: resourceGroup().name
    acaEnvironmentSubscription: subscription().subscriptionId
  }
  dependsOn: [
    backendAcrPull, foundryProject, acaEnv
  ]
}

module frontendUI './modules/acaFrontendUI.bicep' = if (deployFrontendUI) {
  name: 'frontendUI'
  params: {
    name: 'frontend-family-hub'
    location: location
    acaEnvironmentName: acaEnvName
    acrName: 'acrfamilyhub'
    image: frontendUIImage
    identityId: frontendIdentity.outputs.identityId ?? ''
    customDomainName: 'hub.kisbyfamily.com'
    enableCustomDomainTls: enableFrontendCustomDomainTls
  }
  dependsOn: [
    frontendAcrPull, acaEnv
  ]
}

@description('Backend API FQDN')
output backendAPIFqdn string = backendAPI.outputs.containerAppFqdn ?? 'Not deployed'

@description('Frontend UI FQDN')
output frontendUIFqdn string = frontendUI.outputs.containerAppFqdn ?? 'Not deployed'

@description('Foundry endpoint')
output foundryEndpoint string = foundryResource.outputs.openaiEndpoint

@description('Container Apps environment ID')
output acaEnvironmentId string = acaEnv.outputs.envId

@description('Status: Backend API deployed')
output backendDeployed bool = deployBackendAPI
