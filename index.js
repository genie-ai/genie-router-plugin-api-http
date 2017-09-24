const http = require('./lib/http')
const client = require('./lib/client')

/**
 * This plugin exposes itself as both a http and a client plugin, in order to be
 * able to expose a HTTP api. It must register itself als a client, and register a
 * HTTP url.
 * Both functions initialize the httpApi, which then handles both receiving a message
 * and sending a reply.
*/
module.exports = {
  http: http,
  client: client
}
