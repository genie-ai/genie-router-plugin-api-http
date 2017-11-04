const uuidv4 = require('uuid/v4')
const debug = require('debug')('genie-router-plugin-api-http:httpApi')

/**
 * Exposes a HTTP route to send messages to that are then processed by the brains.
 * Expects that setConfig, setApp and setRouter are invoked by http and a client.
 */
class HttpApi {
  constructor () {
    this.config = null
    this.openRequests = {}
    this.router = null
    this.app = null
  }

  setConfig (config) {
    this.config = config
  }

  setRouter (router) {
    this.router = router
    if (this.config && this.app) {
      return this._start()
    } else {
      return Promise.resolve()
    }
  }

  setApp (app) {
    this.app = app
    if (this.config && this.router) {
      return this._start()
    } else {
      return Promise.resolve()
    }
  }

  /**
   * Initializes the http routes on the express this.app.
   */
  _start () {
    return new Promise((resolve, reject) => {
      let endpoint = this.config.endpoint ? this.config.endpoint : '/api/message'
      debug('Binding HTTP Api endpoint to %s', endpoint)
      if (this.config.accessToken) {
        this.app.post(
            endpoint,
            this._isAuthenticated.bind(this),
            this._handleMessage.bind(this)
          )
      } else {
        this.app.post(endpoint, this._handleMessage.bind(this))
      }
      this.app.options(endpoint, (req, res) => {
        this._sendCorsHeaders(res)
        res.sendStatus(200)
      })
      resolve()
    })
  }

  /**
   * Speaks a message. Follows the client plugin specs.
   */
  speak (message) {
    return new Promise((resolve, reject) => {
      const uuid = message.metadata.uuid
      if (!this.openRequests[uuid]) {
        reject(new Error('Uuid not found in list of open requests.'))
        return
      }

      const res = this.openRequests[uuid].res
      res.send(
        JSON.stringify(
          {
            id: uuid,
            message: {
              message: message.output,
              metadata: message.metadata.requestMetadata
            }
          }
        )
      )
      clearTimeout(this.openRequests[uuid].timer)
      delete this.openRequests[uuid]
      resolve()
    })
  }

  _isAuthenticated (req, res, next) {
    const accessToken = this.config.accessToken
    if (req.headers['authorization'] && req.headers['authorization'] === 'Bearer ' + accessToken) {
      return next()
    }

    // invalid token
    res.status(401).send(JSON.stringify({'error': 'Invalid accessToken'}))
  }

  _handleMessage (req, res) {
    return new Promise((resolve, reject) => {
      const uuid = uuidv4()

      debug('Handling request, marking with uuid %s %s', uuid, JSON.stringify(req.body))
      this._sendCorsHeaders(res)
      res.setHeader('Content-Type', 'application/json')

      if (!req.body.input) {
        res.send(JSON.stringify({id: uuid, error: 'No input attribute found in request.'}))
        reject(new Error('No input found in request.'))
        return
      }

      const requestMetadata = req.body.metadata ? req.body.metadata : {}
      // set a timeout for processing
      const timer = setTimeout(() => {
        res.send(JSON.stringify({id: uuid, error: 'Timeout contacting brain.'}))
        delete this.openRequests[uuid]
      }, this.config.timeout ? this.config.timeout : 5000)

      let inputMessage = {input: req.body.input, metadata: {uuid: uuid, requestMetadata: requestMetadata}}
      if (requestMetadata.userId) {
        inputMessage.userId = requestMetadata.userId
      }
      if (requestMetadata.sessionId) {
        inputMessage.sessionId = requestMetadata.sessionId
      }
      this.router.heard(inputMessage)
      // set a marker in the openRequests list so that when a reply is returned, we
      // can map it to the request and send a response.
      this.openRequests[uuid] = {res: res, timer: timer}
      resolve()
    })
  }

  _sendCorsHeaders (res) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'POST,OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  }
}

module.exports = new HttpApi()
