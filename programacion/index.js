import express from 'express'
import cors from 'cors'
import bcrypt from 'bcrypt'
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
    const [user] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [id])
    return res.status(200).json(user)
  } catch (err) {
    console.error(err)
  }
})

app.get('/cards', async (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, 'web/cards.html'))
})

app.get('/decks', async (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, 'web/decks.html'))
})

app.get('/packs', async (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, 'web/packs.html'))
})

app.get('/getCards', async (req, res) => {
  try {
    const id = req.query.id
    const idCartas = await connection.query(
      'SELECT id_carta FROM users_cartas WHERE BIN_TO_UUID(id_user) = ?', [id]
    )

    let query = 'SELECT * FROM cartas'
    const orderBy = req.query.ordenType || 'tipo'
    const orderDirection = req.query.orden || 'DESC'

    if (orderBy !== 'rareza' && orderBy !== 'tipo') {
      query += ` ORDER BY ${orderBy} ${orderDirection}, rareza DESC, tipo DESC;`
    } else if (orderBy === 'tipo') {
      query += ` ORDER BY ${orderBy} ${orderDirection}, rareza DESC;`
    } else if (orderBy === 'rareza') {
      query += ` ORDER BY ${orderBy} ${orderDirection}, tipo DESC;`
    }

    const [cards] = await connection.execute(query)
    const idCartasSet = new Set(idCartas[0].map(item => item.id_carta))

    const filteredCards = cards.filter(card => idCartasSet.has(card.id))

    const ataquesPromises = filteredCards.map(async (card) => {
      const [ataques] = await connection.execute('SELECT * FROM ataques WHERE id = ?;', [card.id])
      return ataques
    })

    const ataques = await Promise.all(ataquesPromises)
    const datos = {
      filteredCards,
      ataques
    }
    res.status(200).json(datos)
  } catch (err) {
    console.error(err)
  }
})

app.get('/getDecks', async (req, res) => {
  try {
    const arrayCartasDeck = []
    const id = req.query.id
    const [mazoActual] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?;', [id])
    const [decks] = await connection.execute('SELECT * FROM mazos WHERE BIN_TO_UUID(id_user) = ?;', [id])
    const mazoCartasArray = []
    for (const deck of decks) {
      const [mazoCartas2] = await connection.execute('SELECT id_carta FROM mazo_cartas WHERE id_mazo = ?;', [deck.id])
      mazoCartasArray.push(mazoCartas2)
    }

    for (const mazoCartas of mazoCartasArray) {
      for (const deck of decks) {
        for (const carta of mazoCartas) {
          const [cartas] = await connection.execute('SELECT * FROM cartas WHERE id = ?;', [carta.id_carta])
          const [mazoCarta] = await connection.execute('SELECT * FROM mazo_cartas WHERE id_carta = ? AND id_mazo = ?;', [carta.id_carta, deck.id])

          if (mazoCarta.length > 0) {
            const [ataques] = await connection.execute('SELECT * FROM ataques WHERE id = ?;', [cartas[0].id_ataque])
            const cartaId = cartas[0].id
            const mazoCartaId = mazoCarta[0].id_mazo

            if (!arrayCartasDeck.some(obj => obj.cards[0].id === cartaId && obj.mazoCarta === mazoCartaId && obj.ataques[0].id === ataques[0].id)) {
              const cartaObj = {
                cards: cartas,
                ataques,
                mazoCarta: mazoCartaId
              }
              arrayCartasDeck.push(cartaObj)
            }
          }
        }
      }
    }

    const datos = {
      decks,
      arrayCartasDeck,
      mazoActual: mazoActual[0].mazo_seleccionado
    }
    return res.status(200).json(datos)
  } catch (err) {
    console.error(err)
  }
})

app.get('/getCardsDeck', async (req, res) => {
  try {
    const mazo = req.query.mazo
    const idUsuario = req.query.idUsuario

    const [cartasMazo] = await connection.execute('SELECT * FROM mazo_cartas WHERE id_mazo = ?;', [mazo])

    const cartasMazoId = cartasMazo.map(carta => carta.id_carta)

    const [cardsUser] = await connection.execute('SELECT * FROM users_cartas WHERE BIN_TO_UUID(id_user) = ?;', [idUsuario])

    const [cards] = await connection.execute('SELECT * FROM cartas ORDER BY tipo DESC, rareza DESC;')

    const filteredCards = cards.filter(card => !cartasMazoId.includes(card.id))

    const cartasUserId = cardsUser.map(carta => carta.id_carta)

    const filteredCardsUser = filteredCards.filter(card => cartasUserId.includes(card.id))

    const ataquesPromises = filteredCardsUser.map(async (card) => {
      const [ataques] = await connection.execute('SELECT * FROM ataques WHERE id = ?;', [card.id])
      return ataques
    })

    const ataques = await Promise.all(ataquesPromises)
    const datos = {
      filteredCards: filteredCardsUser,
      ataques
    }

    return res.status(200).json(datos)
  } catch (err) {
    console.error(err)
  }
})

app.get('/checkPacks', async (req, res) => {
  try {
    const id = req.query.id
    const [user] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [id])
    return res.status(200).json(user[0].sobres)
  } catch (err) {
    console.error(err)
  }
})

app.get('/abrirSobre', async (req, res) => {
  try {
    const id = req.query.id
    const [user] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?;', [id])
    if (user[0].sobres === 0) return res.status(200).json({ message: 'noSobres' })
    const [cartasUser] = await connection.execute('SELECT * FROM users_cartas WHERE BIN_TO_UUID(id_user) = ?;', [id])
    const cartasUserId = cartasUser.map((carta) => carta.id_carta)
    const arrayCartas = []
    const [cartas] = await connection.execute('SELECT * FROM cartas;')
    cartas.forEach((carta) => {
      if (carta.rareza === 1) {
        for (let i = 0; i < 5; i++) {
          arrayCartas.push(carta)
        }
      } else if (carta.rareza === 2) {
        for (let i = 0; i < 4; i++) {
          arrayCartas.push(carta)
        }
      } else if (carta.rareza === 3) {
        for (let i = 0; i < 3; i++) {
          arrayCartas.push(carta)
        }
      } else if (carta.rareza === 4) {
        for (let i = 0; i < 2; i++) {
          arrayCartas.push(carta)
        }
      } else {
        arrayCartas.push(carta)
      }
    })

    const randomCards = []
    for (let i = 0; i < 4; i++) {
      let duplicated = true
      let duplicatedUser = true
      let randomIndex

      const randomCardsId = randomCards.map((carta) => carta.id)

      if (user[0].sobres_iniciales < 2) {
        while (duplicated || duplicatedUser) {
          randomIndex = Math.floor(Math.random() * arrayCartas.length)
          duplicatedUser = cartasUserId.includes(arrayCartas[randomIndex].id)
          duplicated = randomCardsId.includes(arrayCartas[randomIndex].id)
        }
      } else {
        randomIndex = Math.floor(Math.random() * arrayCartas.length)
        duplicatedUser = cartasUserId.includes(arrayCartas[randomIndex].id)
        duplicated = randomCardsId.includes(arrayCartas[randomIndex].id)
        if (duplicated || duplicatedUser) duplicated = true
      }

      const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?;', [arrayCartas[randomIndex].id_ataque])

      randomCards.push({
        id: arrayCartas[randomIndex].id,
        carta: arrayCartas[randomIndex],
        ataque: ataque[0],
        duplicate: duplicated
      })
    }

    if (user[0].sobres_iniciales < 2) {
      await connection.execute('UPDATE users SET sobres_iniciales = sobres_iniciales + 1 WHERE BIN_TO_UUID(id) = ?;', [id])
    }

    await connection.execute('UPDATE users SET sobres = sobres - 1 WHERE BIN_TO_UUID(id) = ?', [id])

    randomCards.forEach(async (carta) => {
      if (!carta.duplicate) {
        await connection.execute('INSERT INTO users_cartas (id_user, id_carta) VALUES (UUID_TO_BIN(?), ?);', [id, carta.id])
      }
    })

    return res.status(200).json(randomCards)
  } catch (err) {
    console.error(err)
  }
})

app.get('/shop', (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, 'web/shop.html'))
})

app.get('/getShopCards', async (req, res) => {
  const id = req.query.id
  console.log(id)
  const [shop] = await connection.execute('SELECT * FROM mercado_cartas WHERE BIN_TO_UUID(id_user) != ?;', [id])
  const cardId = shop.map(carta => carta.id_carta)
  console.log(cardId)
  const arrayCartas = []
  for (const carta of shop) {
    const [card] = await connection.execute('SELECT * FROM cartas WHERE id = ?;', [carta.id_carta])
    const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?;', [card[0].id_ataque])

    arrayCartas.push({
      id: carta.id,
      carta: card[0],
      ataque: ataque[0],
      precio: carta.precio
    })
  }
  return res.status(200).json(arrayCartas)
})

app.get('/getShopChests', async (req, res) => {
  try {
    const [chestsShop] = await connection.execute('SELECT * FROM tienda_sobres;')
    return res.status(200).json(chestsShop)
  } catch (err) {
    console.error(err)
  }
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
    const [rows] = await connection.execute('SELECT BIN_TO_UUID(id) AS id, first_log, password FROM users WHERE user = ?', [usernameLogin])
    console.log(rows[0])
    const result = await bcrypt.compare(passwordLogin, rows[0].password)

    if (!result) {
      return res.status(200).json({ message: 'Credenciales incorrectas' })
    }
    const firstLog = rows[0].first_log
    if (rows.length > 0) {
      console.log('Autenticación exitosa')
      return res.status(200).json({ message: 'Credenciales correctas', isFirstLog: firstLog, id: rows[0].id })
    } else {
      return res.status(200).json({ message: 'Credenciales incorrectas' })
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

    if (password !== rPassword) {
      return res.status(200).json({ message: 'samePwd' })
    }
    const hashedPassword = await bcrypt.hash(password, 10)
    await connection.execute(
      'INSERT INTO users (nombre, apellidos, email, user, password) VALUES (?, ?, ?, ?, ?)', [name, surname, email, username, hashedPassword]
    )

    const id = await connection.execute('SELECT BIN_TO_UUID(id) AS id FROM users WHERE user = ?', [username])
    for (let i = 0; i < 3; i++) {
      await connection.execute('INSERT INTO mazos (numero, id_user) VALUES (?, UUID_TO_BIN(?))', [i + 1, id[0][0].id])
    }

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
    text: `Change your password in the following link: http://13.53.190.234/change?id=${users[0].id}`
  }
  sendEmail(request, response)
  return res.status(200).json({ message: 'changed' })
})

app.post('/change-password', async (req, res) => {
  const { id, newPassword, newPasswordR } = req.body
  console.log(id)
  if (newPassword !== newPasswordR) {
    return res.status(200).json({ message: 'samePwd' })
  }

  const [user] = await connection.execute('SELECT password FROM users WHERE BIN_TO_UUID(id) = ?', [id])
  console.log(user[0])
  const result = await bcrypt.compare(newPassword, user[0].password)

  if (result) {
    return res.status(200).json({ message: 'pswAlreadyExists' })
  }

  const newHashedPassword = await bcrypt.hash(newPassword, 10)
  await connection.execute(
    'UPDATE users SET password = ? WHERE BIN_TO_UUID(id) = ?', [newHashedPassword, id]
  )
  return res.status(200).json({ message: 'changed' })
})

app.post('/start', async (req, res) => {
  try {
    const { username } = req.body
    await connection.execute(
      'UPDATE users SET first_log = false WHERE user = ?', [username]
    )
    res.status(200).json({ message: 'updated' })
  } catch (e) {
    console.error(e)
  }
})

app.post('/changeProfilePicture', async (req, res) => {
  try {
    const { profilePicture, id } = req.body
    await connection.execute(
      'UPDATE users SET foto_perfil = ? WHERE BIN_TO_UUID(id) = ?', [profilePicture, id]
    )
    res.status(200).json({ message: 'updated' })
  } catch (e) {
    console.error(e)
  }
})

app.post('/guardarCarta', async (req, res) => {
  try {
    const idCarta = req.body.idCarta
    const idCartaMazo = req.body.idCartaMazo
    const mazoActual = req.body.mazoActual

    console.log(idCarta)
    console.log(idCartaMazo)
    console.log(mazoActual)

    if (idCartaMazo === 0) {
      await connection.execute(
        'INSERT INTO mazo_cartas (id_mazo, id_carta) VALUES (?, ?)', [mazoActual, idCarta]
      )
    } else {
      await connection.execute(
        'UPDATE mazo_cartas SET id_carta = ? WHERE id_carta = ? AND id_mazo = ?', [idCarta, idCartaMazo, mazoActual]
      )
    }

    return res.status(200).json({ message: 'updated' })
  } catch (err) {
    console.error(err)
  }
})

app.post('/nuevoMazo', async (req, res) => {
  try {
    const id = req.body.id
    const nuevoMazo = req.body.nuevoMazo
    await connection.execute(
      'UPDATE users SET mazo_seleccionado = ? WHERE BIN_TO_UUID(id) = ?', [nuevoMazo, id]
    )
    return res.status(200).json({ message: 'updated' })
  } catch (err) {
    console.error(err)
  }
})

app.post('/quickSell', async (req, res) => {
  try {
    const id = req.body.id
    const oroCarta = req.body.oroCarta
    await connection.execute(
      'UPDATE users SET oro = oro + ? WHERE BIN_TO_UUID(id) = ?', [oroCarta, id]
    )
    return res.status(200).json({ message: 'updated' })
  } catch (err) {
    console.error(err)
  }
})

app.post('/putOnMarket', async (req, res) => {
  try {
    const id = req.body.id
    const idCarta = req.body.idCarta
    const precio = req.body.precio
    console.log(id)
    console.log(idCarta)
    console.log(precio)
    await connection.execute('INSERT INTO mercado_cartas (id_user, id_carta, precio) VALUES (UUID_TO_BIN(?), ?, ?)', [id, idCarta, precio])
    return res.status(200).json({ message: 'Uploaded into the market' })
  } catch (err) {
    console.error(err)
  }
})

app.post('/confirmBuy', async (req, res) => {
  try {
    const id = req.body.id
    const precio = req.body.precio
    const [user] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [id])
    if (user[0].oro < precio) {
      return res.status(200).json({ message: 'Not enough gold' })
    }
    return res.status(200).json({ message: 'Enough gold' })
  } catch (err) {
    console.error(err)
  }
})

app.post('/buyCard', async (req, res) => {
  try {
    const id = req.body.id
    const idCarta = req.body.idCarta
    const precio = req.body.precio
    console.log(id)
    console.log(idCarta)
    console.log(precio)
    const [user] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [id])
    console.log(user[0])
    if (user[0].oro < precio) {
      return res.status(200).json({ message: 'Not enough gold' })
    }
    return res.status(200).json({ message: 'Card bought' })
  } catch (err) {
    console.error(err)
  }
})

const PORT = process.env.PORT ?? 1234
const HOST = '0.0.0.0'

app.use(express.static(join(__dirname, 'web')))

app.listen(PORT, HOST, () => {
  console.log(`Listening from http://13.53.190.234/:${PORT}`)
})
