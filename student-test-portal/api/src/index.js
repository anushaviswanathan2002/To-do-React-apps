import path from 'node:path'
import { existsSync } from 'node:fs'
import express from 'express'
import { openDb } from './db.js'
import { createApp } from './app.js'

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET environment variable is required')
  process.exit(1)
}
const app = createApp(openDb())
const dist = path.resolve('../web/dist/web/browser')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}
const port = process.env.PORT || 3002
app.listen(port, () => console.log(`Test portal API listening on ${port}`))
