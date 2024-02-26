import express from 'express'
import cors from 'cors'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const app = express()
app.use(express.json())
app.use(cors())
app.disable('x-powered-by')

const __dirname = dirname(fileURLToPath(import.meta.url))

app.get('/', (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, 'web/index.html'))
})

app.get('/intro', (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, 'web/introduccion.html'))
})

const PORT = process.env.PORT ?? 1234

app.use(express.static(join(__dirname, 'web')))

app.listen(PORT, () => {
  console.log('server listening on port http://localhost:' + PORT)
})
