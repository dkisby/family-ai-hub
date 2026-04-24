param name string
param location string
param logAnalyticsWorkspaceId string

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: name
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

resource acrDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'acrDiagnostics'
  scope: acr
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'ContainerRegistryRepositoryEvents'
        enabled: true
      }
      {
        category: 'ContainerRegistryLoginEvents'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

output acrId string = acr.id
output acrLoginServer string = acr.properties.loginServer
