param location string = resourceGroup().location
param tenantId string

module logAnalytics './modules/logAnalytics.bicep' = {
  name: 'logAnalytics'
  params: {
    name: 'log-family-hub'
    location: location
  }
}

module keyVault './modules/keyVault.bicep' = {
  name: 'keyVault'
  params: {
    name: 'kv-family-hub'
    location: location
    tenantId: tenantId
  }
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
  }
}

module acaEnv './modules/acaEnvironment.bicep' = {
  name: 'acaEnv'
  params: {
    name: 'aca-family-hub'
    location: location
    logAnalyticsId: logAnalytics.outputs.workspaceId
  }
}
