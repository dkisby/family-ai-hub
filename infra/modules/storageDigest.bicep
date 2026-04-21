param name string
param location string

resource stg 'Microsoft.Storage/storageAccounts@2023-01-01' = {
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
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2022-09-01' = {
  parent: stg
  name: 'default'
}

resource enableStaticWebsite 'Microsoft.Resources/deploymentScripts@2023-08-01' = {
  name: 'enableStaticWebsite-${name}'
  location: location
  kind: 'AzureCLI'
  properties: {
    azCliVersion: '2.50.0'
    retentionInterval: 'PT1H'
    scriptContent: '''
      az storage blob service-properties update \
        --account-name ${STORAGE_NAME} \
        --static-website true \
        --index-document index.html \
        --404-document 404.html \
        --auth-mode login
    '''
    environmentVariables: [
      {
        name: 'STORAGE_NAME'
        value: name
      }
    ]
  }
  dependsOn: [stg]
}

output webUrl string = stg.properties.primaryEndpoints.web
output storageName string = stg.name
