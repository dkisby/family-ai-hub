@description('Container App name')
param name string

@description('Custom domain name for the Container App')
param customDomainName string = 'hub.kisbyfamily.com'

@description('Enable TLS binding for the custom domain (requires hostname pre-registration in environment)')
param enableCustomDomainTls bool = false

@description('Location for the Container App')
param location string

@description('Existing ACA environment name')
param acaEnvironmentName string

@description('ACR name (e.g. acrfamilyhub)')
param acrName string

@description('Image name in ACR (e.g. openwebui:latest)')
param image string = 'ghcr.io/open-webui/open-webui:latest'

@description('Entra app registration client ID for WebUI')
param aadClientId string

@description('Entra tenant ID')
param tenantId string

@description('Resource ID of the user-assigned managed identity')
param identityId string

@description('AAD client secret value (passed directly to avoid KV-reference provisioning dependency)')
@secure()
param aadClientSecret string

@description('CPU cores for the container')
param cpu string = '0.5'

@description('Memory for the container')
param memory string = '1Gi'

@description('Minimum replicas')
param minReplicas int = 0

@description('Maximum replicas')
param maxReplicas int = 1

@description('Azure OpenAI endpoint')
param aoaiEndpoint string

@description('Azure OpenAI deployment name')
param aoaiDeploymentName string

@description('Azure OpenAI Resource ID')
param aoaiResourceId string

resource acaEnv 'Microsoft.App/managedEnvironments@2023-05-01' existing = {
  name: acaEnvironmentName
}

@description('Managed certificate for the custom domain')
resource managedCert 'Microsoft.App/managedEnvironments/managedCertificates@2024-03-01' = if (enableCustomDomainTls) {
  name: replace(customDomainName, '.', '-')
  parent: acaEnv
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

resource webui 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: acaEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
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
      secrets: [
        {
          name: 'microsoft-provider-authentication-secret'
          value: aadClientSecret
        }
        {
          name: 'azure-openai-key'
          value: listKeys(aoaiResourceId, '2023-05-01').key1
        }
      ]
      dapr: {
        enabled: false
      }
    }
    template: {
      containers: [
        {
          name: 'webui'
          image: image
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          env: [
            {
              name: 'PORT'
              value: '8080'
            }
            {
              name: 'AOAI_ENDPOINT'
              value: aoaiEndpoint
            }
            {
              name: 'AOAI_DEPLOYMENT_NAME'
              value: aoaiDeploymentName
            }
            {
              name: 'WEBUI_AUTH'
              value: 'false'
            }
            {
              name: 'WEBUI_AUTH_TRUSTED_EMAIL_HEADER'
              value: 'X-MS-CLIENT-PRINCIPAL-NAME'
            }
            {
              name: 'LOGOUT_REDIRECT_URL'
              value: '/.auth/logout'
            }
            {
              name: 'OPENWEBUI_MODEL'
              value: 'azure:${aoaiDeploymentName}'
            }
            {
              name: 'AZURE_OPENAI_ENDPOINT'
              value: aoaiEndpoint
            }
            {
              name: 'AZURE_OPENAI_API_VERSION'
              value: '2024-02-15-preview'
            }
            {
              name: 'AZURE_OPENAI_API_KEY'
              secretRef: 'azure-openai-key'
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

var loginEndpoint = environment().authentication.loginEndpoint
var normalizedLoginEndpoint = endsWith(loginEndpoint, '/') ? loginEndpoint : '${loginEndpoint}/'
var openIdIssuer = '${normalizedLoginEndpoint}${tenantId}/v2.0'

resource webuiAuth 'Microsoft.App/containerApps/authConfigs@2024-03-01' = {
  parent: webui
  name: 'current'
  properties: {
    platform: {
      enabled: true
    }
    globalValidation: {
      unauthenticatedClientAction: 'RedirectToLoginPage'
      redirectToProvider: 'azureactivedirectory'
    }
    login: {
      allowedExternalRedirectUrls: [
        'https://${customDomainName}/.auth/login/aad/callback'
      ]
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: aadClientId
          clientSecretSettingName: 'microsoft-provider-authentication-secret'
          openIdIssuer: openIdIssuer
        }
        validation: {
          allowedAudiences: [
            'api://${aadClientId}'
          ]
        }
      }
    }
  }
}

output webuiUrl string = 'https://${webui.properties.configuration.ingress.fqdn}'
output customDomainUrl string = 'https://${customDomainName}'
output acaDefaultFqdn string = webui.properties.configuration.ingress.fqdn
output principalId string = webui.identity.userAssignedIdentities[identityId].principalId
