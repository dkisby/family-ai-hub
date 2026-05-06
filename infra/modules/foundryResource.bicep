@description('Resource name for AI Services')
param resourceName string = 'ai-family-hub'

@description('Location for the resource')
param location string

@description('SKU name for AI Services')
param skuName string = 'S0'

@description('Log Analytics workspace ID for diagnostics')
param logAnalyticsWorkspaceId string

resource aiServices 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: resourceName
  location: location
  kind: 'AIServices'
  sku: {
    name: skuName
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    customSubDomainName: resourceName
  }
}

resource aiServicesDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'aiServicesDiagnostics'
  scope: aiServices
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'Audit'
        enabled: true
      }
      {
        category: 'RequestResponse'
        enabled: true
      }
      {
        category: 'Trace'
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

output resourceId string = aiServices.id
output endpoint string = aiServices.properties.endpoint
output openaiEndpoint string = '${aiServices.properties.endpoint}openai/v1'
output resourceName string = aiServices.name
