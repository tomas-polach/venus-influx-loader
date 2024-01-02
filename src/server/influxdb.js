const { InfluxDB: InfluxDBClient, Point } = require('@influxdata/influxdb-client')
const _ = require('lodash')
const debug = require('debug')('venus-server:influxdb')

function InfluxDB (app) {
  this.app = app
  this.logger = app.getLogger('influxdb')
  this.debug = this.logger.debug.bind(this.logger)
  this.info = this.logger.info.bind(this.logger)
  this.error = this.logger.error.bind(this.logger)

  app.on('settingsChanged', settings => {
    const {
      url,
      token,
      org,
      bucket,
      retention,
      // todo: consider batch write interval
      // batchWriteInterval
    } = settings.influxdb

    if (
      this.url !== url ||
      this.token !== token ||
      this.org !== org ||
      this.bucket !== bucket
    ) {
      // todo: update client
    }
  })
}

InfluxDB.prototype.setRetentionPolicy = function (client, retention) {
  // todo: implement retention policy
  return new Promise().resolve();
}

InfluxDB.prototype.connect = function () {
  const {
    url,
    token,
    org,
    bucket,
    retention,
  } = this.app.config.settings.influxdb
  this.url = url
  this.token = token
  this.org = org
  this.bucket = bucket
  this.info(
    `Attempting connection to ${url}/${bucket} using token ${this.token.substring(0, 6)}...`
  )
  this.client = new InfluxDBClient({
    url: url,
    token: token,
  }).getWriteApi(this.org, this.bucket, 'ns', {
    // todo: add these to configs
    /** max number of records/lines to send in a batch   */
    batchSize: 1000,
    /** delay between data flushes in milliseconds, at most `batch size` records are sent during flush  */
    flushInterval: 2000,
    // /** default tags, unescaped */
    // defaultTags?: Record<string, string>;
    // /** HTTP headers that will be sent with every write request */
    // headers?: {
    //     [key: string]: string;
    //   };
    //   /** When specified, write bodies larger than the threshold are gzipped  */
    //   gzipThreshold?: number;
    //   /** max size of a batch in bytes */
    //   maxBatchBytes: number;
    // /** InfluxDB Enterprise write consistency as explained in https://docs.influxdata.com/enterprise_influxdb/v1.9/concepts/clustering/#write-consistency */
    // consistency?: 'any' | 'one' | 'quorum' | 'all';
  })

  // todo: create bucket if needed
  //   client
  //     .getDatabaseNames()
  //     .then(names => {
  //       this.info('Connected')
  //       if (names.includes(bucket)) {
  //         this.setRetentionPolicy(client, retention)
  //           .then(() => {
  //             resolve(client)
  //           })
  //           .catch(reject => {
  //             this.error(`Unable to set retention policy: ${reject}`)
  //           })
  //       } else {
  //         client.createDatabase(bucket).then(result => {
  //           this.info('Created InfluxDb bucket ' + bucket)
  //           this.setRetentionPolicy(client, retention)
  //             .then(() => {
  //               resolve(client)
  //             })
  //             .catch(reject => {
  //               this.error(`Unable to create bucket ${bucket}: ${reject}`)
  //             })
  //         })
  //       }
  //     })
  //     .catch(reject => {
  //       this.error(`Unable to connect: ${reject}`)
  //     })
  // })

  return Promise.resolve(this.client)
}

InfluxDB.prototype.store = function (
  portalId,
  name,
  instanceNumber,
  measurement,
  value
) {
  if (!this.client || _.isUndefined(value) || value === null) {
    // nothing to write
    return
  }

  if (typeof value !== 'number' && typeof value !== 'string') {
    // ignore values other than numbers and strings
    return
  }

  if (typeof value === 'string' && value.length === 0) {
    //influxdb won't allow empty strings
    return
  }

  const p = new Point(measurement)
    .tag('portalId', portalId)
    .tag('instanceNumber', instanceNumber)
    .tag('name', name || portalId)

  if (typeof value === 'number') {
    p.floatField('value', value)
  } else if (typeof value === 'string') {
    p.stringField('stringValue', value)
  }

  this.client.writePoint(p)
}

module.exports = InfluxDB
