param location string = resourceGroup().location

@description('Entra app client ID for WebUI')
param webuiAadClientId string

@description('Entra app client secret for WebUI EasyAuth')
@secure()
param webuiAadClientSecret string

@description('Whether to deploy the WebUI container app')
param deployWebUI bool = false

@description('Custom domain name for the WebUI')
param customDomainName string

@description('Enable TLS binding for custom domain on WebUI (set true only after hostname bootstrap deploy)')
param enableCustomDomainTls bool = false

@description('Azure OpenAI deployment name')
param aoaiDeploymentName string = 'gpt-4o-mini'

@description('Azure OpenAI model name')
param aoaiModelName string = 'gpt-4o-mini'

@description('Azure OpenAI model version (must be supported in selected region)')
param aoaiModelVersion string = '2024-07-18'

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
  dependsOn: [keyVault]
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

module webuiIdentity './modules/managedIdentity.bicep' = {
  name: 'webuiIdentity'
  params: {
    name: 'id-webui-family-hub'
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

module openAi './modules/openAi.bicep' = {
  name: 'openAi'
  params: {
    name: 'aoai-family-hub'
    location: location
    deploymentName: aoaiDeploymentName
    modelName: aoaiModelName
    modelVersion: aoaiModelVersion
  }
}

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
    aoaiEndpoint: openAi.outputs.endpoint
    aoaiResourceId: openAi.outputs.aoaiResourceId
    aoaiDeploymentName: openAi.outputs.deploymentName
  }
  dependsOn: [
    webuiAcrPull
  ]
}
