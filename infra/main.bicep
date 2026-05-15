param location string = resourceGroup().location

@description('Whether to deploy the backend API')
param deployBackendAPI bool = false

@description('Whether to deploy the frontend UI')
param deployFrontendUI bool = false

@description('Whether to deploy PostgreSQL Flexible Server')
param deployPostgres bool = false

@description('PostgreSQL administrator login')
param postgresAdminLogin string = 'dbadmin'

@description('PostgreSQL administrator password')
@secure()
param postgresAdminPassword string = ''

@description('Backend API container image')
param backendAPIImage string = 'mcr.microsoft.com/k8se/quickstart:latest'

@description('Frontend UI container image')
param frontendUIImage string = 'mcr.microsoft.com/k8se/quickstart:latest'

@description('Foundry default model name')
param foundryDefaultModel string = 'gpt-4.1-mini'

@description('Foundry model version')
param foundryModelVersion string = '2025-04-14'

@description('Entra SPA app client ID')
param entraClientId string = ''

@description('Entra API app client ID')
param entraApiClientId string = ''

@description('Frontend origin allowed for backend CORS')
param frontendOrigin string = 'https://hub.kisbyfamily.com'

@description('Enable TLS binding for frontend custom domain. Use false for first run to register hostname, then true to issue and bind managed cert.')
param enableFrontendCustomDomainTls bool = false

var tenantId = tenant().tenantId
var acaEnvName = 'env-family-hub'
var logAnalyticsName = 'log-family-hub'
var postgresServerName = 'psql-family-hub'

// Build DATABASE_URL whenever a password is supplied.
// This lets backend-only redeploys keep DB connectivity without requiring deployPostgres=true.
var databaseUrl = empty(postgresAdminPassword)
  ? ''
  : 'postgresql://${postgresAdminLogin}:${postgresAdminPassword}@${postgresServerName}.postgres.database.azure.com:5432/familyhub?sslmode=require'

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

module postgres './modules/postgresFlexServer.bicep' = if (deployPostgres) {
  name: 'postgres'
  params: {
    name: postgresServerName
    location: location
    administratorLogin: postgresAdminLogin
    administratorPassword: postgresAdminPassword
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
    entraClientId: entraClientId
    entraApiClientId: entraApiClientId
    frontendOrigin: frontendOrigin
    foundryEndpoint: foundryResource.outputs.openaiEndpoint
    foundryApiKey: keyVaultRef.getSecret('foundry-api-key')
    databaseUrl: databaseUrl
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
