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

@description('Custom domain name for the Container App')
param customDomainName string = 'hub.kisbyfamily.com'

@description('Enable TLS binding for the custom domain (requires hostname pre-registration in environment)')
param enableCustomDomainTls bool = true
resource acaEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' existing = {
  name: acaEnvironmentName
}

@description('Managed certificate for the custom domain')
resource managedCert 'Microsoft.App/managedEnvironments/managedCertificates@2024-03-01' = if (enableCustomDomainTls) {
  name: replace(customDomainName, '.', '-')
  parent: acaEnvironment
  location: location
  properties: {
    subjectName: customDomainName
    domainControlValidation: 'CNAME'
  }
}

var customDomainBinding = enableCustomDomainTls
  ? {
      name: customDomainName
      certificateId: managedCert.id
      bindingType: 'SniEnabled'
    }
  : {
      name: customDomainName
      bindingType: 'Disabled'
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
        customDomains: [
          customDomainBinding
        ]
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

@description('Frontend UI custom domain URL')
output customDomainUrl string = 'https://${customDomainName}'

@description('Container App default FQDN')
output acaDefaultFqdn string = containerApp.properties.configuration.ingress.fqdn
