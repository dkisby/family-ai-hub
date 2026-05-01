param name string
param location string

@description('Model deployment name in Azure OpenAI account')
param deploymentName string = 'gpt-4.1-mini'

@description('Azure OpenAI model name')
param modelName string = 'gpt-4.1-mini'

@description('Azure OpenAI model version (must be region-supported)')
param modelVersion string = '2025-04-14'

resource aoai 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: name
  location: location
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
  }
}

resource aoaiDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  name: deploymentName
  parent: aoai
  sku: {
    name: 'Standard'
    capacity: 1
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: modelName
      version: modelVersion
    }
  }
}

output endpoint string = aoai.properties.endpoint
output deploymentName string = aoaiDeployment.name
output aoaiResourceId string = aoai.id
