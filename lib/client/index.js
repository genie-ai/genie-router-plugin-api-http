const httpApi = require('../httpApi')

function start (config, router) {
  httpApi.setConfig(config)
  return httpApi.setRouter(router)
    .then(function () {
      return {speak: httpApi.speak.bind(httpApi)}
    })
}

module.exports = {start: start}
