// ============================================================
// REACT FRONTEND + BACKEND API - NEW DEPLOYMENT ARCHITECTURE
// ============================================================
// This extended main.bicep adds modern React SPA + Node.js API
// deployment alongside existing WebUI infrastructure

param location string = resourceGroup().location

// ====================
// WebUI Parameters (Legacy - to be removed)
// ====================
@description('Entra app client ID for WebUI')
param webuiAadClientId string

@description('Entra app client secret for WebUI EasyAuth')
@secure()
param webuiAadClientSecret string

@description('Whether to deploy the WebUI container app')
param deployWebUI bool = false

@description('Custom domain name for the WebUI')
param customDomainName string

@description('Enable TLS binding for custom domain on WebUI')
param enableCustomDomainTls bool = false

@description('WebUI admin email address')
param webuiAdminEmail string

// ====================
// New React Frontend Parameters
// ====================
@description('Whether to deploy the React frontend')
param deployReactFrontend bool = false

@description('GitHub repository URL for Static Web App')
param githubRepositoryUrl string = ''

@description('GitHub repository branch')
param githubRepositoryBranch string = 'main'

@description('GitHub personal access token for repository access')
@secure()
param githubToken string = ''

// ====================
// New Backend API Parameters
// ====================
@description('Whether to deploy the backend API')
param deployBackendAPI bool = false

@description('Backend API container image')
param backendAPIImage string = 'acrfamilyhub.azurecr.io/backend-family-hub:latest'

// ====================
// Foundry Parameters
// ====================
@description('Foundry default model name')
param foundryDefaultModel string = 'gpt-4.1-mini'

@description('Foundry model version')
param foundryModelVersion string = '2025-04-14'

var tenantId = tenant().tenantId
var acaEnvName = 'env-family-hub'
var logAnalyticsName = 'log-family-hub'

// ============================================================
// SHARED INFRASTRUCTURE (Log Analytics, Key Vault, Storage, ACR)
// ============================================================

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

resource aadClientSecretKv 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVaultRef
  name: 'webui-aad-client-secret'
  properties: {
    value: webuiAadClientSecret
  }
  dependsOn: [keyVault]
}

module storagePrivate './modules/storagePrivate.bicep' = {
  name: 'storagePrivate'
  params: {
    name: 'stgfamilyhubcore'
    location: location
  }
}

module storageDigest './modules/storageDigest.bicep' = {
  name: 'storageDigest'
  params: {
    name: 'stgfamilyhubdigest'
    location: location
  }
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

// ============================================================
// MANAGED IDENTITIES
// ============================================================

module webuiIdentity './modules/managedIdentity.bicep' = {
  name: 'webuiIdentity'
  params: {
    name: 'id-webui-family-hub'
    location: location
  }
}

module backendIdentity './modules/managedIdentity.bicep' = if (deployBackendAPI) {
  name: 'backendIdentity'
  params: {
    name: 'id-backend-family-hub'
    location: location
  }
}

module webuiAcrPull './modules/acrPullRoleAssignment.bicep' = {
  name: 'webuiAcrPull'
  params: {
    acrName: 'acrfamilyhub'
    principalId: webuiIdentity.outputs.principalId
  }
  dependsOn: [acr]
}

module backendAcrPull './modules/acrPullRoleAssignment.bicep' = if (deployBackendAPI) {
  name: 'backendAcrPull'
  params: {
    acrName: 'acrfamilyhub'
    principalId: deployBackendAPI ? backendIdentity.outputs.principalId : ''
  }
  dependsOn: [acr]
}

// ============================================================
// FOUNDRY (Azure OpenAI)
// ============================================================

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

// ============================================================
// LEGACY: WebUI Container App (to be removed)
// ============================================================

module acaWebUI './modules/acaWebUI.bicep' = if (deployWebUI) {
  name: 'acaWebUI'
  params: {
    name: 'webui-family-hub'
    location: location
    acaEnvironmentName: acaEnvName
    acrName: 'acrfamilyhub'
    image: 'acrfamilyhub.azurecr.io/openwebui:latest'
    customDomainName: customDomainName
    enableCustomDomainTls: enableCustomDomainTls
    aadClientId: webuiAadClientId
    aadClientSecret: webuiAadClientSecret
    tenantId: tenantId
    identityId: webuiIdentity.outputs.identityId
    cpu: '0.5'
    memory: '1Gi'
    minReplicas: 0
    maxReplicas: 1
    foundryEndpoint: foundryResource.outputs.openaiEndpoint
    foundryResourceId: foundryResource.outputs.resourceId
    foundryDefaultModel: foundryDefaultModel
    webuiAdminEmail: webuiAdminEmail
  }
  dependsOn: [
    webuiAcrPull, foundryProject
  ]
}

// ============================================================
// NEW: React Frontend (Azure Static Web App)
// ============================================================

module staticWebApp './modules/staticWebApp.bicep' = if (deployReactFrontend) {
  name: 'staticWebApp'
  params: {
    name: 'swa-chatui-hub'
    location: 'westus2' // Static Web App has limited region support
    repositoryUrl: githubRepositoryUrl
    repositoryBranch: githubRepositoryBranch
    githubToken: githubToken
    appLocation: 'build/frontend'
    buildFolder: 'build/frontend/dist'
  }
}

// ============================================================
// NEW: Backend API (Container App)
// ============================================================

module backendAPI './modules/acaBackendAPI.bicep' = if (deployBackendAPI) {
  name: 'backendAPI'
  params: {
    name: 'backend-family-hub'
    location: location
    acaEnvironmentName: acaEnvName
    acrName: 'acrfamilyhub'
    image: backendAPIImage
    identityId: deployBackendAPI ? backendIdentity.outputs.identityId : ''
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

// ============================================================
// OUTPUTS
// ============================================================

@description('Static Web App hostname (React Frontend)')
output staticWebAppHostname string = deployReactFrontend ? staticWebApp.outputs.defaultHostname : 'Not deployed'

@description('Backend API FQDN')
output backendAPIFqdn string = deployBackendAPI ? backendAPI.outputs.containerAppFqdn : 'Not deployed'

@description('Foundry endpoint')
output foundryEndpoint string = foundryResource.outputs.openaiEndpoint

@description('Container Apps environment ID')
output acaEnvironmentId string = acaEnv.outputs.envId

@description('Status: React frontend deployed')
output frontendDeployed bool = deployReactFrontend

@description('Status: Backend API deployed')
output backendDeployed bool = deployBackendAPI
