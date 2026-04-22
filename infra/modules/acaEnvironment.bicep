param name string
param location string
param logAnalyticsCustomerId string

@secure()
param logAnalyticsSharedKey string

resource env 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: name
  location: location
  identity: {
    type: 'SystemAssigned'
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsCustomerId
        sharedKey: logAnalyticsSharedKey
      }
    }
  }
}

output envId string = env.id
