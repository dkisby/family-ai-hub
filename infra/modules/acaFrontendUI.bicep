@description('Container App name for frontend UI')
param name string

@description('Location for the Container App')
param location string

@description('Existing ACA environment name')
param acaEnvironmentName string

@description('ACR name')
param acrName string

@description('Frontend UI image')
param image string

@description('Resource ID of the user-assigned managed identity')
param identityId string

@description('Container App environment resource group')
param acaEnvironmentResourceGroup string

@description('Container App environment subscription')
param acaEnvironmentSubscription string

// Reference existing ACA environment
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
        targetPort: 80
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
          name: 'ui'
          image: image
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          probes: [
            {
              type: 'liveness'
              httpGet: {
                path: '/'
                port: 80
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'readiness'
              httpGet: {
                path: '/'
                port: 80
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}

@description('Frontend UI FQDN')
output containerAppFqdn string = containerApp.properties.configuration.ingress.fqdn
