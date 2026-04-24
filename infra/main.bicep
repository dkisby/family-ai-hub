param location string = resourceGroup().location

@description('Entra app client ID for WebUI')
param webuiAadClientId string

var tenantId = tenant().tenantId
var acaEnvName = 'aca-env-family-hub'
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
  dependsOn: [
    keyVault
  ]
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

module acaWebUI './modules/acaWebUI.bicep' = {
  name: 'acaWebUI'
  params: {
    name: 'webui-family-hub'
    location: location
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    acaEnvironmentName: acaEnvName
    acrName: 'acrfamilyhub'
    image: 'openwebui:latest'
    aadClientId: webuiAadClientId
    tenantId: tenantId
    cpu: '0.5'
    memory: '1Gi'
    minReplicas: 0
    maxReplicas: 1
  }
}
