targetScope = 'resourceGroup'

@description('Location for future DBM Azure resources.')
param location string = resourceGroup().location

@description('Common tags applied to future DBM Azure resources.')
param tags object = {
  product: 'Dynamics Business Machine'
  owner: 'Ahmed Elsawalhy / Yagasoft'
  releaseTrain: 'R0'
}

output contractSummary object = {
  location: location
  tags: tags
  resources: []
}
