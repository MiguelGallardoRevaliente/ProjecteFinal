/* eslint-disable no-undef */
/* eslint-disable no-unreachable */
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

let username = ''
let password = ''

app.get('/', (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, 'web/index.html'))
})

app.get('/intro', (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, 'web/introduccion.html'))
})

app.get('/menu', (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, 'web/game.html'))
})

app.post('/login', async (req, res) => {
  try {
    const { usernameLogin, passwordLogin } = req.body
    console.log(req.body)
    const [rows] = await connection.execute('SELECT * FROM users WHERE user = ? AND password = ?', [usernameLogin, passwordLogin])
    console.log(rows[0].first_log)
    const firstLog = rows[0].first_log
    if (rows.length > 0) {
      console.log('Autenticación exitosa')
      username = usernameLogin
      password = passwordLogin
      return res.status(200).json({ message: 'Credenciales correctas', isFirstLog: firstLog })
    } else {
      return res.status(401).json({ message: 'Credenciales incorrectas' })
    }
  } catch (error) {
    console.error('Error en la autenticación:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
})

app.post('/register', async (req, res) => {
  try {
    const { name, surname, email, username, password } = req.body
    console.log(req.body)
  } catch (e) {
    console.error(e)
  }
})

app.post('/start', async (req, res) => {
  try {
    console.log(username, '/', password)
    await connection.execute(
      'UPDATE users SET first_log = false WHERE user = ? AND password = ?', [username, password]
    )
    console.log('Se actualizó la bbdd')
    res.status(200).json({ message: username })
  } catch (e) {
    console.error(e)
  }
})

const PORT = process.env.PORT ?? 1234

app.use(express.static(join(__dirname, 'web')))

app.listen(PORT, () => {
  console.log(`server listening on port http://localhost:${PORT}`)
})
