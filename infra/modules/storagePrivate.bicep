param name string
param location string
param logAnalyticsWorkspaceId string

resource stgPrivate 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: name
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Disabled'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2022-09-01' = {
  parent: stgPrivate
  name: 'default'
}

resource queueService 'Microsoft.Storage/storageAccounts/queueServices@2022-09-01' = {
  parent: stgPrivate
  name: 'default'
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2022-09-01' = {
  parent: stgPrivate
  name: 'default'
}

resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2022-09-01' = {
  parent: stgPrivate
  name: 'default'
}

resource digestDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'digestDiagnostics'
  scope: stgPrivate
  dependsOn: [
    blobService
    queueService
    tableService
    fileService
  ]
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'StorageRead'
        enabled: true
      }
      {
        category: 'StorageWrite'
        enabled: true
      }
      {
        category: 'StorageDelete'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'Transaction'
        enabled: true
      }
      {
        category: 'Capacity'
        enabled: true
      }
    ]
  }
}

output storageId string = stgPrivate.id
output storageName string = stgPrivate.name
