const fetch = require('node-fetch')
const fs = require('fs')
const _ = require('lodash')

const apiUrl = 'https://vrmapi.victronenergy.com'

module.exports = function (app) {
  const logger = app.getLogger('vrm')

  function good (msg) {
    app.emit('vrmStatus', { status: 'success', message: msg })
    logger.info(msg)
  }

  function fail (msg) {
    app.emit('vrmStatus', { status: 'failure', message: msg })
    logger.error(msg)
  }

  app.post('/requestToken', (req, res, next) => {
    if (!req.body.tokenName || req.body.tokenName.length === 0) {
      good('Please enter a token name')
      res.status(500).send()
      return
    }

    const post = {
      username: req.body.username,
      password: req.body.password
    }
    good('Logging In')
    fetch(`${apiUrl}/v2/auth/login`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(post)
    })
      .then(response => response.json())
      .then(response => {
        if (!_.isUndefined(response.success) && !response.success) {
          fail(response.errors)
          app.emit('error', response.errors)
          res.status(500).send()
        } else {
          const token = response['token']
          const idUser = response['idUser']

          fetch(`${apiUrl}/v2/users/${idUser}/accesstokens/create`, {
            method: 'POST',
            headers: { 'X-Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              name: req.body.tokenName
            })
          })
            .then(response => response.json())
            .then(response => {
              if (!_.isUndefined(response.success) && !response.success) {
                fail(response.errors.name || response.errors)
                app.emit('error', response.errors.name || response.errors)
                res.status(500).send()
              } else {
                good('Token Created')
                app.config.secrets.vrmToken = response.token
                app.config.secrets.vrmTokenId = response.idAccessToken
                app.config.secrets.vrmUserId = idUser
                fs.writeFile(
                  app.config.secretsLocation,
                  JSON.stringify(app.config.secrets, null, 2),
                  err => {
                    if (err) {
                      logger.error(err)
                      res.status(500).send('Unable to write secrets file')
                    } else {
                      res.send()
                      loadPortalIDs()
                    }
                  }
                )
              }
            })
            .catch(err => {
              app.emit('error', err)
              fail(err.message)
              res.status(500).send()
            })
        }
      })
  })

  function loadPortalIDs () {
    if (!app.config.secrets.vrmToken) {
      fail('Please login')
      return
    }

    good('Getting installations')

    fetch(`${apiUrl}/v2/users/${app.config.secrets.vrmUserId}/installations`, {
      headers: { 'X-Authorization': `Token ${app.config.secrets.vrmToken}` }
    })
      .then(response => response.json())
      .then(response => {
        if (!_.isUndefined(response.success) && !response.success) {
          fail(response.errors)
        } else {
          const devices = response.records.map(record => {
            return { portalId: record.identifier, name: record.name }
          })
          logger.debug('got response %j', response)
          app.emit('vrmDiscovered', devices)
          good('Installations Retrieved')
        }
      })
      .catch(err => {
        app.emit('error', err)
        fail(err.message)
      })
  }

  return {
    loadPortalIDs: loadPortalIDs
  }
}
