@description('Container App name')
param name string

@description('Location for the Container App')
param location string

@description('Existing ACA environment name')
param acaEnvironmentName string

@description('ACR name (e.g. acrfamilyhub)')
param acrName string

@description('Image name in ACR (e.g. openwebui:latest)')
param image string

@description('Entra app registration client ID for WebUI')
param aadClientId string

@description('Entra tenant ID')
param tenantId string

@description('Log Analytics workspace ID for diagnostics')
param logAnalyticsWorkspaceId string

@description('CPU cores for the container')
param cpu string = '0.5'

@description('Memory for the container')
param memory string = '1Gi'

@description('Minimum replicas')
param minReplicas int = 0

@description('Maximum replicas')
param maxReplicas int = 1

// Existing ACA environment
resource acaEnv 'Microsoft.App/managedEnvironments@2023-05-01' existing = {
  name: acaEnvironmentName
}

resource webui 'Microsoft.App/containerApps@2023-05-01' = {
  name: name
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: acaEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
      }
      registries: [
        {
          server: '${acrName}.azurecr.io'
          identity: 'system'
        }
      ]
      secrets: []
      dapr: {
        enabled: false
      }
    }
    template: {
      containers: [
        {
          name: 'webui'
          image: '${acrName}.azurecr.io/${image}'
          resources: {
            cpu: cpu
            memory: memory
          }
          env: [
            {
              name: 'PORT'
              value: '8080'
            }
            {
              name: 'WEBUI_AUTH'
              value: 'false'
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

resource webuiAuth 'Microsoft.App/containerApps/authConfigs@2023-05-01' = {
  parent: webui
  name: 'current'
  properties: {
    platform: {
      enabled: true
    }
    globalValidation: {
      unauthenticatedClientAction: 'RedirectToLoginPage'
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: aadClientId
          openIdIssuer: 'https://login.microsoftonline.com/${tenantId}/v2.0'
        }
      }
    }
  }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-${name}'
  scope: webui
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

output webuiUrl string = 'https://${webui.properties.configuration.ingress.fqdn}'
output principalId string = webui.identity.principalId
