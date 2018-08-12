const httpApi = require('../httpApi');

async function start(config, router) {
    httpApi.setConfig(config);
    await httpApi.setRouter(router);
    return { speak: httpApi.speak.bind(httpApi) };
}

module.exports = { start };
