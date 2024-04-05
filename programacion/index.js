import express from 'express'
import cors from 'cors'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { sendEmail } from './controller/mail.js'

import mysql from 'mysql2/promise'

const DEFAULT_CONFIG = {
  host: 'localhost',
  user: 'root',
  port: 3306,
  password: 'root',
  database: 'chamousdb'
}

const connectionString = process.env.DATABASE_URL ?? DEFAULT_CONFIG

const connection = await mysql.createConnection(connectionString)

const app = express()
app.use(express.json())
app.use(cors())
app.disable('x-powered-by')

const __dirname = dirname(fileURLToPath(import.meta.url))

app.get('/login', (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, 'web/index.html'))
})

app.get('/change', (req, res) => {
  const id = req.query.id
  if (id) {
    res.header('Allow-Control-Allow-Origin', '*')
    res.sendFile(join(__dirname, 'web/change.html'))
  }
})

app.get('/intro', (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, 'web/introduccion.html'))
})

app.get('/', (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, 'web/game.html'))
})

app.get('/infoUser', async (req, res) => {
  try {
    const id = req.query.id
    console.log(id)
    const [user] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [id])
    console.log(user[0])
    return res.status(200).json(user[0])
  } catch (err) {
    console.error(err)
  }
})

app.get('/inventory', async (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, 'web/inventory.html'))
})

app.get('/cards', async (req, res) => {
  try {
    const id = req.query.id
    const idCartas = await connection.query(
      'SELECT id_carta FROM users_cartas WHERE BIN_TO_UUID(id_user) = ?', [id]
    )

    console.log(idCartas[0])

    let query = 'SELECT * FROM cartas'
    const orderBy = req.query.ordenType || 'rareza'
    const orderDirection = req.query.orden || 'DESC'

    query += ` ORDER BY ${orderBy} ${orderDirection};`

    const [cards] = await connection.execute(query)
    console.log(cards)
    const idCartasSet = new Set(idCartas[0].map(item => item.id_carta))

    const filteredCards = cards.filter(card => idCartasSet.has(card.id))
    console.log(filteredCards)
    res.status(200).json(filteredCards)
  } catch (err) {
    console.error(err)
  }
})

app.get('/shop', (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, 'web/shop.html'))
})

app.get('/information', (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, 'web/information.html'))
})

app.get('/settings', (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, 'web/settings.html'))
})

app.post('/login', async (req, res) => {
  try {
    const { usernameLogin, passwordLogin } = req.body
    const [rows] = await connection.execute('SELECT BIN_TO_UUID(id) AS id, first_log FROM users WHERE user = ? AND password = ?', [usernameLogin, passwordLogin])
    const firstLog = rows[0].first_log
    if (rows.length > 0) {
      console.log('Autenticación exitosa')
      return res.status(200).json({ message: 'Credenciales correctas', isFirstLog: firstLog, id: rows[0].id })
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
    const { name, surname, email, username, password, rPassword } = req.body
    const [users] = await connection.execute('SELECT * FROM users')

    for (const user of users) {
      if (user.user === username) {
        return res.status(200).json({ message: 'userExists' })
      } else if (user.email === email) {
        return res.status(200).json({ message: 'emailExists' })
      }
    }

    console.log(password)
    console.log(rPassword)

    if (password !== rPassword) {
      return res.status(200).json({ message: 'samePwd' })
    }
    await connection.execute(
      'INSERT INTO users (nombre, apellidos, email, user, password) VALUES (?, ?, ?, ?, ?)', [name, surname, email, username, password]
    )
    return res.status(200).json({ message: 'registered' })
  } catch (e) {
    console.error(e)
  }
})

app.post('/forgot', async (req, res) => {
  const { email } = req.body
  const [users] = await connection.execute('SELECT password, BIN_TO_UUID(id) AS id FROM users WHERE email = ?', [email])
  if (users.length === 0) {
    return res.status(200).json({ message: 'emailNotExists' })
  }

  const response = {}
  const request = {
    to: email,
    subject: 'Recuperación de contraseña',
    text: `Change your password in the following link: http://localhost:1234/change?id=${users[0].id}`
  }
  sendEmail(request, response)
  return res.status(200).json({ message: 'changed' })
})

app.post('/change-password', async (req, res) => {
  const { id, newPassword, newPasswordR } = req.body
  if (newPassword !== newPasswordR) {
    return res.status(200).json({ message: 'samePwd' })
  }
  const { password } = await connection.execute('SELECT password FROM users WHERE BIN_TO_UUID(id) = ?', [id])
  if (password === newPassword) {
    return res.status(200).json({ message: 'pswAlreadyExists' })
  }
  await connection.execute(
    'UPDATE users SET password = ? WHERE BIN_TO_UUID(id) = ?', [newPassword, id]
  )
  return res.status(200).json({ message: 'changed' })
})

app.post('/start', async (req, res) => {
  try {
    const { username, password } = req.body
    await connection.execute(
      'UPDATE users SET first_log = false WHERE user = ? AND password = ?', [username, password]
    )
    console.log('Se actualizó la bbdd')
    res.status(200).json({ message: 'updated' })
  } catch (e) {
    console.error(e)
  }
})

const PORT = process.env.PORT ?? 1234
const HOST = '0.0.0.0'

app.use(express.static(join(__dirname, 'web')))

app.listen(PORT, HOST, () => {
  console.log(`Listening from http://13.53.190.234/:${PORT}`)
})
