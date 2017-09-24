const httpApi = require('../httpApi')

function start (config, app) {
  httpApi.setConfig(config)
  return httpApi.setApp(app)
}

module.exports = {start: start}
