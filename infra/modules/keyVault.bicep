param name string
param location string
param tenantId string
param logAnalyticsWorkspaceId string

resource kv 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: name
  location: location
  properties: {
    tenantId: tenantId
    enabledForTemplateDeployment: true
    enablePurgeProtection: true
    enableSoftDelete: true
    accessPolicies: []
    enableRbacAuthorization: true
    sku: {
      name: 'standard'
      family: 'A'
    }
    publicNetworkAccess: 'Enabled'
  }
}

resource kvDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'kvDiagnostics'
  scope: kv
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'AuditEvent'
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


output vaultUri string = kv.properties.vaultUri
output vaultId string = kv.id
output name string = kv.name
