@description('Name of the PostgreSQL Flexible Server (must be globally unique)')
param name string

@description('Location for the server')
param location string

@description('Administrator login name')
param administratorLogin string

@description('Administrator password')
@secure()
param administratorPassword string

@description('Name of the database to create')
param databaseName string = 'familyhub'

@description('PostgreSQL major version')
param version string = '16'

@description('SKU name — Standard_B1ms is the cheapest burstable option')
param skuName string = 'Standard_B1ms'

@description('SKU tier')
@allowed(['Burstable', 'GeneralPurpose', 'MemoryOptimized'])
param skuTier string = 'Burstable'

// ─── Server ────────────────────────────────────────────────────────────────────

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: name
  location: location
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    version: version
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
  }
}

// ─── Firewall: allow Azure services (Container Apps use dynamic IPs) ──────────

resource allowAzureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: postgresServer
  name: 'allow-azure-services'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ─── Database ─────────────────────────────────────────────────────────────────

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgresServer
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// ─── Outputs ──────────────────────────────────────────────────────────────────

@description('Fully qualified domain name of the server')
output fqdn string = postgresServer.properties.fullyQualifiedDomainName

@description('Server name')
output serverName string = postgresServer.name

@description('Database name')
output databaseName string = databaseName
