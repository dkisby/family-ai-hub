@description('Container App name for backend API')
param name string

@description('Location for the Container App')
param location string

@description('Existing ACA environment name')
param acaEnvironmentName string

@description('ACR name')
param acrName string

@description('Backend API image')
param image string

@description('Resource ID of the user-assigned managed identity')
param identityId string

@description('Entra tenant ID')
param tenantId string

@description('Foundry endpoint')
param foundryEndpoint string

@description('Foundry API key from Key Vault')
@secure()
param foundryApiKey string

@description('Container App environment resource group')
param acaEnvironmentResourceGroup string

@description('Container App environment subscription')
param acaEnvironmentSubscription string
resource acaEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' existing = {
  scope: resourceGroup(acaEnvironmentSubscription, acaEnvironmentResourceGroup)
  name: acaEnvironmentName
}

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: name
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: acaEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3001
        transport: 'auto'
      }
      registries: [
        {
          server: '${acrName}.azurecr.io'
          identity: identityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: image
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'PORT'
              value: '3001'
            }
            {
              name: 'FOUNDRY_ENDPOINT'
              value: foundryEndpoint
            }
            {
              name: 'FOUNDRY_API_KEY'
              value: foundryApiKey
            }
            {
              name: 'ENTRA_TENANT_ID'
              value: tenantId
            }
            {
              name: 'NODE_ENV'
              value: 'production'
            }
          ]
          probes: [
            {
              type: 'liveness'
              httpGet: {
                path: '/health'
                port: 3001
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'readiness'
              httpGet: {
                path: '/health'
                port: 3001
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 3
      }
    }
  }
}

output containerAppId string = containerApp.id
output containerAppName string = containerApp.name
output containerAppFqdn string = containerApp.properties.configuration.ingress.fqdn
