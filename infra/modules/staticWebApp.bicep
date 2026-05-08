@description('Azure Static Web App for React frontend')
param name string

@description('Location for the Static Web App')
param location string

@description('GitHub repository URL')
param repositoryUrl string

@description('Repository branch to deploy')
param repositoryBranch string = 'main'

@description('github token for repository access')
@secure()
param githubToken string

@description('Build output folder')
param buildFolder string = 'build/frontend/dist'

@description('App location in repository')
param appLocation string = 'build/frontend'

resource staticWebApp 'Microsoft.Web/staticSites@2022-03-01' = {
  name: name
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: repositoryUrl
    branch: repositoryBranch
    buildProperties: {
      appLocation: appLocation
      outputLocation: buildFolder
      appBuildCommand: 'npm run build'
      skipGithubActionWorkflowGeneration: true
    }
    provider: 'GitHub'
    linkedBackends: []
  }
}

output staticSiteId string = staticWebApp.id
output defaultHostname string = staticWebApp.properties.defaultHostname
output staticSiteName string = staticWebApp.name
output repositoryUrl string = repositoryUrl
