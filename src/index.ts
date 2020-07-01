import express from 'express'
import cors from 'cors'
import { promisify } from 'util'
import redis from 'redis'
import https from 'https'
import fs from 'fs'

import { IS_DEV, EVENT, PASSWORD } from './settings'

const handles = [
  'jehovanisig',
  'piema100',
  'daniellejacoby',
  'k1ngjmenace',
  'kyanpalmer',
  'youngdellzc9',
  'irisofficial',
  'alcalderon',
  'soulex',
  'edvarsten',
  'bcruz99',
  'carolenamusic',
  'cecethekidd',
  'therealletrevious',
  'ms.karoline',
  'iamjdhumnl',
  'wymondsr',
  'ricoxrolando',
  'devon7arnold',
  'kaliakeylah',
  'song_birdy',
  'issthakidd.leee',
  'mannysolo',
  'realnohajvegas',
  'jermarcusriggins',
  'daneamar',
  'missshefali',
  'sanni',
  't-lyon',
  'mungowona',
  'jrice42',
]

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({extended: true}))

app.post('/votes/:name', async (req, res, next) => {
  try {
    let client = redis.createClient()

    let set       = promisify(client.set).bind(client)
    let sadd      = (promisify(client.sadd).bind(client)) as any
    let sismember = promisify(client.sismember).bind(client)
    let zincrby   = promisify(client.zincrby).bind(client)

    let id  = req.body.id

    if (!id) {
      res.status(500).json({
        errorType: 'no_id',
        error: 'id is required',
      })
      return
    }

    let exists = await sismember(EVENT+'_voters', id)

    if (exists) {
      res.status(500).json({
        errorType: 'already_voted',
        error: id + ' already voted',
      })
      return
    }

    let ip = (req.headers['x-forwarded-for'] ?? req.connection.remoteAddress ?? 'no-ip') as string

    let ps = [
      sadd(EVENT + '_voters', id),
      zincrby(EVENT + '_votes', 1, req.params.name),
      set(EVENT + '_' + id + '_vote', req.params.name),
      set(EVENT + '_' + id + '_ip', ip),
    ]

    await Promise.all(ps)

    console.log('vote for', req.params.name)

    res.json({
      status: 'success',
    })
  } catch (err) {
    console.log('votes error:', err)
    res.status(500).json({
      errorType: 'server_error',
      error: err.toString(),
    })
  }
})

app.post('/views/:name', async (req, res, next) => {
  try {
    let client = redis.createClient()

    let zincrby = promisify(client.zincrby).bind(client)
    zincrby(EVENT+'_views', 1, req.params.name),

    console.log('view for', req.params.name)

    res.json({
      status: 'success',
    })
  } catch (err) {
    console.log('views error:', err)
    res.status(500).json({
      errorType: 'server_error',
      error: err.toString(),
    })
  }
})

app.get('/stats/', async (req, res, next) => {
  let password = req.query.password || req.body.password
  if (password !== PASSWORD) {
    res.status(403).json({
      errorType: 'access_denied',
      error: 'password incorrect',
    })
    return
  }

  try {
    let client = redis.createClient()

    let zscore = promisify(client.zscore).bind(client)

    let ret: any = {}
    let ps = []

    let fn = async (handle: string) => {
      ret[handle] = {
        score: parseInt(await zscore(EVENT + '_votes', handle), 10) || 0,
        views: parseInt(await zscore(EVENT + '_views', handle), 10) || 0,
      }
    }

    for (let k in handles) {
      ps.push(fn(handles[k]))
    }

    await Promise.all(ps)

    res.json(ret)
  } catch (err) {
    console.log('votes error:', err)
    res.status(500).json({
      errorType: 'server_error',
      error: err.toString(),
    })
  }
})

let port = IS_DEV ? 80 : 80

// Start Express Server
app.listen(port)
console.log('Start Listening on ' + port)

https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert')
}, app).listen(443, () => {
  console.log('Listening... on 443')
})
