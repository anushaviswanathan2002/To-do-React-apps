import path from 'node:path'
import { existsSync } from 'node:fs'
import express from 'express'
import { openDb } from './db.js'
import { createApp } from './app.js'

const secret = process.env.JWT_SECRET
if (!secret) {
  console.error('JWT_SECRET environment variable is required')
  process.exit(1)
}
const app = createApp(openDb(), { secret })
const dist = path.resolve('dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}
const port = process.env.PORT || 3001
app.listen(port, () => console.log(`Library API listening on ${port}`))
