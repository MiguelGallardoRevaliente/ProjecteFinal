import express from 'express'
import cors from 'cors'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import mysql from 'mysql2/promise'

const app = express()
app.use(express.json())
app.use(cors())
app.disable('x-powered-by')

const __dirname = dirname(fileURLToPath(import.meta.url))

const DEFAULT_CONFIG = {
  host: 'localhost',
  user: 'root',
  port: 3306,
  password: '',
  database: 'chamous'
}

const connectionString = process.env.DATABASE_URL ?? DEFAULT_CONFIG

const connection = await mysql.createConnection(connectionString)

app.get('/', (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, 'web/index.html'))
})

app.get('/intro', (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, 'web/introduccion.html'))
})

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    console.log(req.body)
    const [rows] = await connection.execute('SELECT * FROM users WHERE user = ? AND password = ?', [username, password])
    console.log(rows.length)
    if (rows.length > 0) {
      console.log('Autenticación exitosa')
      return res.status(200).json({ message: 'Credenciales correctas' })
    } else {
      return res.status(401).json({ message: 'Credenciales incorrectas' })
    }
  } catch (error) {
    console.error('Error en la autenticación:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
})

const PORT = process.env.PORT ?? 1234

app.use(express.static(join(__dirname, 'web')))

app.listen(PORT, () => {
  console.log(`server listening on port http://localhost:${PORT}`)
})
