param name string
param location string
param tenantId string

resource kv 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: name
  location: location
  properties: {
    tenantId: tenantId
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

output vaultUri string = kv.properties.vaultUri
output vaultId string = kv.id
output name string = kv.name
