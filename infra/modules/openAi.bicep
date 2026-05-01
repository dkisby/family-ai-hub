param name string
param location string

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
  name: 'gpt-4o-mini'
  parent: aoai
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o-mini'
      version: 'latest'
    }
    scaleSettings: {
      scaleType: 'Standard'
    }
  }
}

output endpoint string = aoai.properties.endpoint
output deploymentName string = aoaiDeployment.name
output aoaiResourceId string = aoai.id
