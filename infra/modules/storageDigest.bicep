param name string
param location string

resource stgDigest 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: name
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: true
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
}

  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2022-09-01' = {
  parent: stgDigest   // or stgPrivate
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
    isVersioningEnabled: true
    changeFeed: {
      enabled: true
    }
    restorePolicy: {
      enabled: false
    }
  }
}

resource queueService 'Microsoft.Storage/storageAccounts/queueServices@2022-09-01' = {
  parent: stgDigest
  name: 'default'
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2022-09-01' = {
  parent: stgDigest
  name: 'default'
}

resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2022-09-01' = {
  parent: stgDigest
  name: 'default'
}

output webUrl string = stgDigest.properties.primaryEndpoints.web
output storageName string = stgDigest.name
