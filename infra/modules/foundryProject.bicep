@description('Resource ID of the parent AI Services account')
param aiServicesResourceId string

@description('Default model to deploy')
param defaultModelName string = 'gpt-4o'

@description('Default model version')
param defaultModelVersion string = '2024-12-19'

// Extract account name from resource ID
var accountName = split(aiServicesResourceId, '/')[8]

@description('Deploy default model to AI Services account')
resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  name: '${accountName}/${defaultModelName}'
  sku: {
    name: 'Standard'
    capacity: 10
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: defaultModelName
      version: defaultModelVersion
    }
  }
}

output modelDeploymentName string = defaultModelName

