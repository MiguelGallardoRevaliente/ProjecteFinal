import express from 'express'
import cors from 'cors'
import bcrypt from 'bcrypt'

import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { sendEmail } from './controller/mail.js'

import { Server } from 'socket.io'
import { createServer } from 'node:http'

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
const server = createServer(app)
const io = new Server(server, {
  connectionStateRecovery: {}
})

app.use(express.json())
app.use(cors())
app.disable('x-powered-by')

const __dirname = dirname(fileURLToPath(import.meta.url))

io.on('connection', async (socket) => {
  console.log('A user has connected')

  socket.on('search-battle', async (data) => {
    const [user] = await connection.execute('SELECT * FROM users WHERE user = ?', [data.username])

    const [mazoSeleccionado] = await connection.execute('SELECT * FROM mazos WHERE BIN_TO_UUID(id_user) = ? AND numero = ?', [data.id, user[0].mazo_seleccionado])
    const [mazo] = await connection.execute('SELECT * FROM mazo_cartas WHERE id_mazo = ?', [mazoSeleccionado[0].id])

    if (mazo.length !== 8) {
      console.log('No se puede buscar partida sin un mazo completo')
      if (user[0].searching === 1) {
        await connection.execute('UPDATE users SET searching = 0 WHERE user = ?', [data.username])
      }
      io.emit('battle-error', { message: 'No se puede buscar partida sin un mazo completo', username: data.username })
      return
    }

    if (user[0].searching === 1) {
      await connection.execute('UPDATE users SET searching = 0 WHERE user = ?', [data.username])
      console.log('Búsqueda de partida cancelada')
      io.emit('battle-cancelled', { username: data.username })
      return
    }

    console.log('Se recibió una solicitud de búsqueda de partida')

    await connection.execute('UPDATE users SET searching = 1 WHERE user = ?', [data.username])

    const [userSearching] = await connection.execute('SELECT *, BIN_TO_UUID(id) AS id_uuid FROM users WHERE searching = 1 AND user != ?', [data.username])

    if (userSearching.length > 0) {
      await connection.execute('UPDATE users SET searching = 0, fighting = 1 WHERE user = ?', [data.username])
      await connection.execute('UPDATE users SET searching = 0, fighting = 1 WHERE user = ?', [userSearching[0].user])

      await connection.execute('INSERT INTO combates (id_user_1, id_user_2, mana_user_1, mana_user_2, turno) VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, UUID_TO_BIN(?))', [data.id, userSearching[0].id_uuid, 16, 16, data.id])

      const [lastID] = await connection.execute('SELECT BIN_TO_UUID(id_combate) AS id FROM combates WHERE id_user_1 = UUID_TO_BIN(?) AND id_user_2 = UUID_TO_BIN(?)', [data.id, userSearching[0].id_uuid])

      io.emit('battle-found', { user1: data.username, user2: userSearching[0].user, id_combate: lastID[0].id })
    }
  })

  socket.on('play-card', async (data) => {
    const idCarta = data.id
    const username = data.user

    const [user] = await connection.execute('SELECT *, BIN_TO_UUID(id) AS id_uuid FROM users WHERE user = ?', [username])
    const [combate] = await connection.execute('SELECT *, BIN_TO_UUID(id_combate) AS id_combate_uuid, BIN_TO_UUID(id_user_1) AS id_user_1_uuid, BIN_TO_UUID(id_user_2) AS id_user_2_uuid, BIN_TO_UUID(turno) as turno_uuid FROM combates WHERE BIN_TO_UUID(id_user_1) = ? OR BIN_TO_UUID(id_user_2) = ?;', [user[0].id_uuid, user[0].id_uuid])
    if (user[0].id_uuid !== combate[0].turno_uuid) {
      io.emit('not-your-turn', { message: 'Not your turn', username })
      return
    }

    if (combate.length !== 1) {
      io.emit('not-in-match', { message: 'Must be in a match' })
      return
    }

    const [cartaCombate] = await connection.execute('SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND id_carta = ? AND BIN_TO_UUID(id_combate) = ?', [user[0].id_uuid, idCarta, combate[0].id_combate_uuid])

    if (cartaCombate.length > 0) {
      return
    }

    const [mazo] = await connection.execute('SELECT * FROM mazos WHERE BIN_TO_UUID(id_user) = ? AND numero = ?', [user[0].id_uuid, user[0].mazo_seleccionado])
    const [mazoCartas] = await connection.execute('SELECT * FROM mazo_cartas WHERE id_mazo = ?', [mazo[0].id])

    const mazoCartasId = mazoCartas.map(carta => carta.id_carta)
    if (!mazoCartasId.includes(parseInt(idCarta))) {
      io.emit('card-not-deck', { message: 'Card not in deck' })
      return
    }

    const [carta] = await connection.execute('SELECT * FROM cartas WHERE id = ?', [idCarta])
    const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?', [carta[0].id_ataque])

    let mana = 0
    if (user[0].id_uuid === combate[0].id_user_1_uuid) {
      mana = combate[0].mana_user_1 - carta[0].costo_mana
      if (mana < 0) {
        io.emit('not-enough-mana', { message: 'Not enough mana', username })
        return
      } else {
        await connection.execute('UPDATE combates SET mana_user_1 = ? WHERE BIN_TO_UUID(id_combate) = ?', [mana, combate[0].id_combate_uuid])
      }
    } else if (user[0].id_uuid === combate[0].id_user_2_uuid) {
      mana = combate[0].mana_user_2 - carta[0].costo_mana
      if (mana < 0) {
        io.emit('not-enough-mana', { message: 'Not enough mana', username })
        return
      } else {
        await connection.execute('UPDATE combates SET mana_user_2 = ? WHERE BIN_TO_UUID(id_combate) = ?', [mana, combate[0].id_combate_uuid])
      }
    }

    const dataEmit = {
      carta: carta[0],
      ataque: ataque[0],
      user: username,
      mana
    }

    await connection.execute(
      'INSERT INTO cartas_combates (id_user, id_carta, id_combate, ataque, vida) VALUES (UUID_TO_BIN(?), ?, UUID_TO_BIN(?), ?, ?);',
      [user[0].id_uuid, idCarta, combate[0].id_combate_uuid, carta[0].ataque, carta[0].vida]
    )

    io.emit('played-card', dataEmit)
  })

  socket.on('attack', async (data) => {
    console.log('Ataque')
    const cardAttackingId = data.cardAttacking
    const cardAttackedId = data.cardAttacked
    const username = data.username

    let opponentId
    const ataques = []
    const cartasInfo = []

    const [user] = await connection.execute('SELECT *, BIN_TO_UUID(id) AS id_uuid FROM users WHERE user = ?', [username])
    const [combate] = await connection.execute('SELECT *, BIN_TO_UUID(id_combate) AS id_combate_uuid, BIN_TO_UUID(id_user_1) AS id_user_1_uuid, BIN_TO_UUID(id_user_2) AS id_user_2_uuid, BIN_TO_UUID(turno) as turno_uuid FROM combates WHERE BIN_TO_UUID(id_user_1) = ? OR BIN_TO_UUID(id_user_2) = ?;', [user[0].id_uuid, user[0].id_uuid])

    if (user[0].id_uuid === combate[0].id_user_1_uuid) {
      opponentId = combate[0].id_user_2_uuid
    } else if (user[0].id_uuid === combate[0].id_user_2_uuid) {
      opponentId = combate[0].id_user_1_uuid
    }

    const [cartaAttackedInfo] = await connection.execute('SELECT * FROM cartas WHERE id = ?;', [cardAttackedId])
    const [cartaAttacked] = await connection.execute('SELECT * FROM cartas_combates WHERE id_carta = ? AND BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;', [cardAttackedId, opponentId, combate[0].id_combate_uuid])
    // console.log(cartaAttacked)

    if (cartaAttacked[0].efecto_secundario && cartaAttacked[0].efecto_secundario === 'inmune') {
      console.log('Carta inmune')
      io.emit('immune-card', { message: 'Card is immune', username })
      return
    }

    // const [cartaAttackingInfo] = await connection.execute('SELECT * FROM cartas WHERE id = ?;', [cardAttackingId])
    const [cartaAttacking] = await connection.execute('SELECT * FROM cartas_combates WHERE id_carta = ? AND BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;', [cardAttackingId, user[0].id_uuid, combate[0].id_combate_uuid])
    // console.log(cartaAttacking)

    let vida = cartaAttacked[0].vida - cartaAttacking[0].ataque
    // console.log(cartaAttacked[0].vida, cartaAttacking[0].ataque)
    if (vida <= 0) {
      vida = 0
    }

    let mana = 0
    if (user[0].id_uuid === combate[0].id_user_1_uuid) {
      await connection.execute('UPDATE cartas_combates SET vida = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;', [vida, cardAttackedId, combate[0].id_combate_uuid, combate[0].id_user_2_uuid])
      if (vida === 0) {
        if (cartaAttacked[0].efecto_secundario === 'reverse') {
          await connection.execute(
            'UPDATE cartas_combates SET ataque = ?, efecto_secundario = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
            [cartaAttackedInfo[0].ataque, cardAttackedId, combate[0].id_combate_uuid, combate[0].id_user_2_uuid]
          )
        }
        mana = combate[0].mana_user_2 + cartaAttackedInfo[0].costo_mana
        await connection.execute('UPDATE combates SET mana_user_2 = ? WHERE BIN_TO_UUID(id_combate) = ?', [mana, combate[0].id_combate_uuid])
      }
    } else if (user[0].id_uuid === combate[0].id_user_2_uuid) {
      await connection.execute('UPDATE cartas_combates SET vida = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;', [vida, cardAttackedId, combate[0].id_combate_uuid, combate[0].id_user_1_uuid])
      if (vida === 0) {
        if (cartaAttacked[0].efecto_secundario === 'reverse') {
          await connection.execute(
            'UPDATE cartas_combates SET ataque = ?, efecto_secundario = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
            [cartaAttackedInfo[0].ataque, cardAttackedId, combate[0].id_combate_uuid, combate[0].id_user_1_uuid]
          )
        }
        mana = combate[0].mana_user_1 + cartaAttackedInfo[0].costo_mana
        await connection.execute('UPDATE combates SET mana_user_1 = ? WHERE BIN_TO_UUID(id_combate) = ?', [mana, combate[0].id_combate_uuid])
      }
    }

    const [opponent] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [opponentId])

    const dataEmit = {
      cardAttacking: cartaAttacking[0],
      cardAttacked: cartaAttacked[0],
      vida,
      opponent: opponent[0].user,
      mana
    }

    /* Duracion del efecto de las cartas del usuario 1 */
    if (user[0].id_uuid === combate[0].id_user_1_uuid) {
      const [cartasUser1] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?',
        [combate[0].id_user_1_uuid, combate[0].id_combate_uuid]
      )

      for (const carta of cartasUser1) {
        const [cartaInfo] = await connection.execute('SELECT * FROM cartas WHERE id = ?', [carta.id_carta])

        if (carta.duracion_efecto <= 1 && carta.efecto_secundario) {
          // Efecto está a punto de finalizar
          if (carta.estadistica_efecto === 'ataque') {
            await connection.execute(
              'UPDATE cartas_combates SET ataque = ?, efecto_secundario = NULL, duracion_efecto = NULL, estadistica_efecto = NULL, cambio_estadistica = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
              [cartaInfo[0].ataque, carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_1_uuid] // Asegúrate del id_user correcto
            )
          } else if (carta.efecto_secundario === 'corrosivo') {
            let vida = carta.vida - carta.cambio_estadistica
            if (vida < 0) {
              vida = 0
              if (cartaAttacked[0].efecto_secundario === 'reverse') {
                await connection.execute(
                  'UPDATE cartas_combates SET ataque = ?, efecto_secundario = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
                  [cartaAttackedInfo[0].ataque, cardAttackedId, combate[0].id_combate_uuid, combate[0].id_user_1_uuid]
                )
              }
            }
            await connection.execute(
              'UPDATE cartas_combates SET vida = ?, efecto_secundario = NULL, duracion_efecto = NULL, estadistica_efecto = NULL, cambio_estadistica = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
              [vida, carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_1_uuid] // Asegúrate del id_user correcto
            )
          } else {
            await connection.execute(
              'UPDATE cartas_combates SET efecto_secundario = NULL, duracion_efecto = NULL, estadistica_efecto = NULL, cambio_estadistica = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
              [carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_1_uuid] // Asegúrate del id_user correcto
            )
          }
        } else if (carta.duracion_efecto && carta.duracion_efecto > 1) {
          // Efecto sigue activo
          if (carta.efecto_secundario === 'corrosivo') {
            let vida = carta.vida - carta.cambio_estadistica
            if (vida < 0) {
              vida = 0
              if (cartaAttacked[0].efecto_secundario === 'reverse') {
                await connection.execute(
                  'UPDATE cartas_combates SET ataque = ?, efecto_secundario = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
                  [cartaAttackedInfo[0].ataque, cardAttackedId, combate[0].id_combate_uuid, combate[0].id_user_1_uuid]
                )
              }
            }
            await connection.execute(
              'UPDATE cartas_combates SET duracion_efecto = duracion_efecto - 1, vida = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
              [vida, carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_1_uuid] // Asegúrate del id_user correcto
            )
          } else {
            await connection.execute(
              'UPDATE cartas_combates SET duracion_efecto = duracion_efecto - 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
              [carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_1_uuid] // Asegúrate del id_user correcto
            )
          }
        }
      }
    }

    /* Duracion del efecto de las cartas del usuario 2 */
    if (user[0].id_uuid === combate[0].id_user_2_uuid) {
      const [cartasUser2] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?',
        [combate[0].id_user_2_uuid, combate[0].id_combate_uuid]
      )

      for (const carta of cartasUser2) {
        const [cartaInfo] = await connection.execute('SELECT * FROM cartas WHERE id = ?', [carta.id_carta])

        if (carta.duracion_efecto && carta.duracion_efecto <= 1) {
          // Efecto está a punto de finalizar
          if (carta.efecto_secundario) {
            if (carta.estadistica_efecto === 'ataque') {
              await connection.execute(
                'UPDATE cartas_combates SET ataque = ?, efecto_secundario = NULL, duracion_efecto = NULL, estadistica_efecto = NULL, cambio_estadistica = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
                [cartaInfo[0].ataque, carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_2_uuid]
              )
            } else if (carta.efecto_secundario === 'corrosivo') {
              let vida = carta.vida - carta.cambio_estadistica
              if (vida < 0) {
                vida = 0
                if (cartaAttacked[0].efecto_secundario === 'reverse') {
                  await connection.execute(
                    'UPDATE cartas_combates SET ataque = ?, efecto_secundario = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
                    [cartaAttackedInfo[0].ataque, cardAttackedId, combate[0].id_combate_uuid, combate[0].id_user_2_uuid]
                  )
                }
              }
              await connection.execute(
                'UPDATE cartas_combates SET vida = ?, efecto_secundario = NULL, duracion_efecto = NULL, estadistica_efecto = NULL, cambio_estadistica = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
                [vida, carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_2_uuid]
              )
            } else {
              await connection.execute(
                'UPDATE cartas_combates SET efecto_secundario = NULL, duracion_efecto = NULL, estadistica_efecto = NULL, cambio_estadistica = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
                [carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_2_uuid]
              )
            }
          }
        } else if (carta.duracion_efecto && carta.duracion_efecto > 1) {
          // Efecto sigue activo
          if (carta.efecto_secundario === 'corrosivo') {
            console.log('Corrosivo')
            let vida = carta.vida - carta.cambio_estadistica
            if (vida < 0) {
              vida = 0
              if (cartaAttacked[0].efecto_secundario === 'reverse') {
                await connection.execute(
                  'UPDATE cartas_combates SET ataque = ?, efecto_secundario = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
                  [cartaAttackedInfo[0].ataque, cardAttackedId, combate[0].id_combate_uuid, combate[0].id_user_2_uuid]
                )
              }
            }
            console.log('Vida', vida)
            await connection.execute(
              'UPDATE cartas_combates SET duracion_efecto = duracion_efecto - 1, vida = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
              [vida, carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_2_uuid]
            )
            console.log('Corrosivo2')
          } else {
            await connection.execute(
              'UPDATE cartas_combates SET duracion_efecto = duracion_efecto - 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
              [carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_2_uuid]
            )
          }
        }
      }
    }

    const [cartasCombate] = await connection.execute('SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;', [opponentId, combate[0].id_combate_uuid])
    for (const cartaCombate of cartasCombate) {
      const [carta] = await connection.execute('SELECT * FROM cartas WHERE id = ?;', [cartaCombate.id_carta])
      const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?', [carta[0].id_ataque])
      ataques.push(ataque[0])
      cartasInfo.push(carta[0])
    }

    const cartas = {
      cartasInfo,
      cartasCombate,
      ataques
    }

    if (user[0].id_uuid === combate[0].id_user_1_uuid) {
      await connection.execute('UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?', [combate[0].id_user_2_uuid, combate[0].id_combate_uuid])
    } else if (user[0].id_uuid === combate[0].id_user_2_uuid) {
      await connection.execute('UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?', [combate[0].id_user_1_uuid, combate[0].id_combate_uuid])
    }

    io.emit('ended-turn', { username, cartas })
    io.emit('attacked', dataEmit)
  })

  /* Aqui cuando usas un ataque especial sobre un aliado */
  socket.on('special-attack-ally', async (data) => {
    const idCarta = data.idCartaAttacked
    const idCartaAttacking = data.idCartaAttacking
    const username = data.username
    const idAtaque = data.idAtaque
    const tipo = data.tipo
    const tipoSplited = tipo.split('/')

    let opponentId
    const ataques = []
    const cartasInfo = []

    const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?;', [idAtaque])
    const [user] = await connection.execute('SELECT *, BIN_TO_UUID(id) AS id_uuid FROM users WHERE user = ?', [username])
    const [combate] = await connection.execute('SELECT *, BIN_TO_UUID(id_combate) AS id_combate_uuid, BIN_TO_UUID(id_user_1) AS id_user_1_uuid, BIN_TO_UUID(id_user_2) AS id_user_2_uuid, BIN_TO_UUID(turno) as turno_uuid FROM combates WHERE BIN_TO_UUID(id_user_1) = ? OR BIN_TO_UUID(id_user_2) = ?;', [user[0].id_uuid, user[0].id_uuid])

    if (user[0].id_uuid === combate[0].id_user_1_uuid) {
      opponentId = combate[0].id_user_2_uuid
    } else if (user[0].id_uuid === combate[0].id_user_2_uuid) {
      opponentId = combate[0].id_user_1_uuid
    }

    const [cartasCombate] = await connection.execute(
      'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
      [opponentId, combate[0].id_combate_uuid]
    )
    for (const cartaCombate of cartasCombate) {
      const [carta] = await connection.execute('SELECT * FROM cartas WHERE id = ?;', [cartaCombate.id_carta])
      const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?', [carta[0].id_ataque])
      ataques.push(ataque[0])
      cartasInfo.push(carta[0])
    }

    const cartas = {
      cartasInfo,
      cartasCombate,
      ataques
    }

    if (tipoSplited[0] === 'power-up') {
      const [cartaInfo] = await connection.execute(
        'SELECT * FROM cartas WHERE id = ?;', [idCarta]
      )

      const [cartaCombate] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE id_carta = ? AND BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [idCarta, user[0].id_uuid, combate[0].id_combate_uuid]
      )

      if (!cartaCombate[0].efecto_secundario) {
        if (ataque[0].estadistica === 'vida') {
          let vida = cartaCombate[0].vida + ataque[0].cambio
          if (vida > cartaInfo[0].vida) {
            vida = cartaInfo[0].vida
          }

          await connection.execute(
            'UPDATE cartas_combates SET vida = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
            [vida, idCarta, combate[0].id_combate_uuid, user[0].id_uuid]
          )

          await connection.execute(
            'UPDATE cartas_combates SET ataque_especial = 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
            [idCartaAttacking, combate[0].id_combate_uuid, user[0].id_uuid]
          )
        } else if (ataque[0].estadistica === 'ataque') {
          const ataqueNumber = cartaCombate[0].ataque + ataque[0].cambio
          await connection.execute(
            'UPDATE cartas_combates SET ataque = ?, efecto_secundario = ?, duracion_efecto = ?, estadistica_efecto = ?, cambio_estadistica = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
            [ataqueNumber, tipoSplited[0], ataque[0].duracion, ataque[0].estadistica, ataque[0].cambio, idCarta, combate[0].id_combate_uuid, user[0].id_uuid]
          )

          await connection.execute(
            'UPDATE cartas_combates SET ataque_especial = 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
            [idCartaAttacking, combate[0].id_combate_uuid, user[0].id_uuid]
          )
        }
      } else {
        console.log('Ya tiene efecto')
        io.emit('already-has-effect', { message: 'Already has effect', username })
        return
      }

      const [opponentCards] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [user[0].id_uuid, combate[0].id_combate_uuid]
      )

      await connection.execute(
        'UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?;',
        [opponentId, combate[0].id_combate_uuid]
      )

      io.emit('ended-turn', { username, cartas })
      io.emit('special-attacked-ally', { username, opponentCards })
    }

    if (tipoSplited[0] === 'inmune') {
      const [cartaCombate] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE id_carta = ? AND BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [idCarta, user[0].id_uuid, combate[0].id_combate_uuid]
      )

      if (!cartaCombate.efecto_secundario) {
        await connection.execute(
          'UPDATE cartas_combates SET efecto_secundario = ?, duracion_efecto = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
          [tipoSplited[0], ataque[0].duracion, idCarta, combate[0].id_combate_uuid, user[0].id_uuid]
        )

        await connection.execute(
          'UPDATE cartas_combates SET ataque_especial = 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
          [idCartaAttacking, combate[0].id_combate_uuid, user[0].id_uuid]
        )
      } else {
        console.log('Ya tiene efecto')
        io.emit('already-has-effect', { message: 'Already has effect', username })
        return
      }

      const [opponentCards] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [opponentId, combate[0].id_combate_uuid]
      )

      await connection.execute(
        'UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?;',
        [opponentId, combate[0].id_combate_uuid]
      )

      io.emit('ended-turn', { username, cartas })
      io.emit('special-attacked-ally', { username, opponentCards })
    }
  })

  /* Aqui se recibe la peticion de usar un ataque especial a el mismo */
  socket.on('special-attack-self', async (data) => {
    const idCarta = data.idCartaAttacking
    const username = data.username
    const idAtaque = data.idAtaque
    const tipo = data.tipo

    let opponentId
    const ataques = []
    const cartasInfo = []

    const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?;', [idAtaque])
    const [user] = await connection.execute('SELECT *, BIN_TO_UUID(id) AS id_uuid FROM users WHERE user = ?', [username])
    const [combate] = await connection.execute('SELECT *, BIN_TO_UUID(id_combate) AS id_combate_uuid, BIN_TO_UUID(id_user_1) AS id_user_1_uuid, BIN_TO_UUID(id_user_2) AS id_user_2_uuid, BIN_TO_UUID(turno) as turno_uuid FROM combates WHERE BIN_TO_UUID(id_user_1) = ? OR BIN_TO_UUID(id_user_2) = ?;', [user[0].id_uuid, user[0].id_uuid])

    if (user[0].id_uuid === combate[0].id_user_1_uuid) {
      opponentId = combate[0].id_user_2_uuid
    } else if (user[0].id_uuid === combate[0].id_user_2_uuid) {
      opponentId = combate[0].id_user_1_uuid
    }

    const [cartasCombate] = await connection.execute('SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;', [opponentId, combate[0].id_combate_uuid])
    for (const cartaCombate of cartasCombate) {
      const [carta] = await connection.execute('SELECT * FROM cartas WHERE id = ?;', [cartaCombate.id_carta])
      const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?', [carta[0].id_ataque])
      ataques.push(ataque[0])
      cartasInfo.push(carta[0])
    }

    const cartas = {
      cartasInfo,
      cartasCombate,
      ataques
    }

    if (tipo === 'power-up') {
      const [cartaInfo] = await connection.execute(
        'SELECT * FROM cartas WHERE id = ?;', [idCarta]
      )

      const [cartaCombate] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE id_carta = ? AND BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [idCarta, user[0].id_uuid, combate[0].id_combate_uuid]
      )

      if (!cartaCombate[0].efecto_secundario) {
        if (ataque[0].estadistica === 'vida') {
          let vida = cartaCombate[0].vida + ataque[0].cambio
          if (vida > cartaInfo[0].vida) {
            vida = cartaInfo[0].vida
          }
          await connection.execute(
            'UPDATE cartas_combates SET vida = ?, efecto_secundario = ?, duracion_efecto = ?, estadistica_efecto = ?, cambio_estadistica = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
            [vida, tipo, ataque[0].duracion, ataque[0].estadistica, ataque[0].cambio, idCarta, combate[0].id_combate_uuid, user[0].id_uuid]
          )
        } else if (ataque[0].estadistica === 'ataque') {
          const ataqueNumber = cartaCombate[0].ataque + ataque[0].cambio
          await connection.execute(
            'UPDATE cartas_combates SET ataque = ?, efecto_secundario = ?, duracion_efecto = ?, estadistica_efecto = ?, cambio_estadistica = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
            [ataqueNumber, tipo, ataque[0].duracion, ataque[0].estadistica, ataque[0].cambio, idCarta, combate[0].id_combate_uuid, user[0].id_uuid]
          )
        }

        await connection.execute(
          'UPDATE cartas_combates SET ataque_especial = 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
          [idCarta, combate[0].id_combate_uuid, user[0].id_uuid]
        )
      } else {
        io.emit('already-has-effect', { message: 'Already has effect', username })
        return
      }

      const [opponentCards] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [user[0].id_uuid, combate[0].id_combate_uuid]
      )
      const [opponent] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [opponentId])

      await connection.execute(
        'UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?',
        [opponentId, combate[0].id_combate_uuid]
      )

      io.emit('ended-turn', { username, cartas })
      io.emit('special-attacked-self', { opponent: username, username: opponent[0].user, opponentCards })
    }

    if (tipo === 'inmune') {
      const [cartaCombate] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE id_carta = ? AND BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [idCarta, user[0].id_uuid, combate[0].id_combate_uuid]
      )

      if (!cartaCombate[0].efecto_secundario) {
        await connection.execute(
          'UPDATE cartas_combates SET efecto_secundario = ?, duracion_efecto = ?, estadistica_efecto = ?, cambio_estadistica = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
          [tipo, ataque[0].duracion, ataque[0].estadistica, ataque[0].cambio, idCarta, combate[0].id_combate_uuid, user[0].id_uuid]
        )

        await connection.execute(
          'UPDATE cartas_combates SET ataque_especial = 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
          [idCarta, combate[0].id_combate_uuid, user[0].id_uuid]
        )
      } else {
        io.emit('already-has-effect', { message: 'Already has effect', username })
        return
      }

      const [opponentCards] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [user[0].id_uuid, combate[0].id_combate_uuid]
      )
      const [opponent] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [opponentId])

      await connection.execute(
        'UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?',
        [opponentId, combate[0].id_combate_uuid]
      )

      io.emit('ended-turn', { username, cartas })
      io.emit('special-attacked-self', { opponent: username, username: opponent[0].user, opponentCards })
    }

    if (tipo === 'reverse') {
      const [cartaCombate] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE id_carta = ? AND BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [idCarta, user[0].id_uuid, combate[0].id_combate_uuid]
      )

      if (!cartaCombate[0].efecto_secundario) {
        await connection.execute(
          'UPDATE cartas_combates SET vida = ?, ataque = ?, efecto_secundario = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
          [cartaCombate[0].ataque, cartaCombate[0].vida, tipo, idCarta, combate[0].id_combate_uuid, user[0].id_uuid]
        )

        await connection.execute(
          'UPDATE cartas_combates SET ataque_especial = 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
          [idCarta, combate[0].id_combate_uuid, user[0].id_uuid]
        )
      } else {
        io.emit('already-has-effect', { message: 'Already has effect', username })
        return
      }

      const [opponentCards] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [user[0].id_uuid, combate[0].id_combate_uuid]
      )
      const [opponent] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [opponentId])

      await connection.execute(
        'UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?',
        [opponentId, combate[0].id_combate_uuid]
      )

      io.emit('ended-turn', { username, cartas })
      io.emit('special-attacked-self', { opponent: username, username: opponent[0].user, opponentCards })
    }
  })

  socket.on('special-attack-revive', async (data) => {
    const idCartaAttacked = data.idCartaAttacked
    const idCartaAttacking = data.idCartaAttacking
    const username = data.username
    const idAtaque = data.idAtaque

    let opponentId
    const ataques = []
    const cartasInfo = []
    let manaUser = 0

    const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?;', [idAtaque])
    const [user] = await connection.execute('SELECT *, BIN_TO_UUID(id) AS id_uuid FROM users WHERE user = ?', [username])
    const [combate] = await connection.execute('SELECT *, BIN_TO_UUID(id_combate) AS id_combate_uuid, BIN_TO_UUID(id_user_1) AS id_user_1_uuid, BIN_TO_UUID(id_user_2) AS id_user_2_uuid, BIN_TO_UUID(turno) as turno_uuid FROM combates WHERE BIN_TO_UUID(id_user_1) = ? OR BIN_TO_UUID(id_user_2) = ?;', [user[0].id_uuid, user[0].id_uuid])

    if (user[0].id_uuid === combate[0].id_user_1_uuid) {
      opponentId = combate[0].id_user_2_uuid
      manaUser = combate[0].mana_user_1
    } else if (user[0].id_uuid === combate[0].id_user_2_uuid) {
      opponentId = combate[0].id_user_1_uuid
      manaUser = combate[0].mana_user_2
    }

    const [cartasCombate] = await connection.execute('SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;', [opponentId, combate[0].id_combate_uuid])
    for (const cartaCombate of cartasCombate) {
      const [carta] = await connection.execute('SELECT * FROM cartas WHERE id = ?;', [cartaCombate.id_carta])
      const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?', [carta[0].id_ataque])
      ataques.push(ataque[0])
      cartasInfo.push(carta[0])
    }

    const cartas = {
      cartasInfo,
      cartasCombate,
      ataques
    }

    const [cartaInfo] = await connection.execute(
      'SELECT * FROM cartas WHERE id = ?;', [idCartaAttacked]
    )

    const [cartaCombate] = await connection.execute(
      'SELECT * FROM cartas_combates WHERE id_carta = ? AND BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
      [idCartaAttacked, user[0].id_uuid, combate[0].id_combate_uuid]
    )

    if (ataque[0].nombre === 'Spectral Revive') {
      if (cartaCombate[0].vida === 0) {
        const mana = manaUser - cartaInfo[0].coste_mana
        if (mana < 0) {
          io.emit('not-enough-mana', { message: 'Not enough mana', username })
          return
        }
        console.log('Mana', mana)

        const vida = Math.round(cartaInfo[0].vida / 2)
        console.log('Vida', vida)
        await connection.execute(
          'UPDATE cartas_combates SET vida = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
          [vida, idCartaAttacked, combate[0].id_combate_uuid, user[0].id_uuid]
        )

        if (user[0].id_uuid === combate[0].id_user_1_uuid) {
          await connection.execute(
            'UPDATE combates SET mana_user_1 = ? WHERE BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user_1) = ?;',
            [mana, combate[0].id_combate_uuid, user[0].id_uuid]
          )
        } else if (user[0].id_uuid === combate[0].id_user_2_uuid) {
          await connection.execute(
            'UPDATE combates SET mana_user_2 = ? WHERE BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user_2) = ?;',
            [mana, combate[0].id_combate_uuid, user[0].id_uuid]
          )
        }

        await connection.execute(
          'UPDATE cartas_combates SET ataque_especial = 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
          [idCartaAttacking, combate[0].id_combate_uuid, user[0].id_uuid]
        )

        const [cartasUserInfo] = await connection.execute(
          'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
          [user[0].id_uuid, combate[0].id_combate_uuid]
        )
        const ataquesUser = []
        const cartasInfo = []
        for (const carta of cartasUserInfo) {
          const [cartaInfo] = await connection.execute('SELECT * FROM cartas WHERE id = ?', [carta.id_carta])
          const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?', [cartaInfo[0].id_ataque])
          ataquesUser.push(ataque[0])
          cartasInfo.push(cartaInfo[0])
        }

        const cartasUser = {
          cartasCombate: cartasUserInfo,
          ataques: ataquesUser,
          cartasInfo
        }

        await connection.execute(
          'UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?;',
          [opponentId, combate[0].id_combate_uuid]
        )

        io.emit('ended-turn', { username, cartas })
        io.emit('special-attacked-revive', { username, cartasUser, mana })
      }
    }

    if (ataque[0].nombre === 'Oceanic Rebirth') {
      if (cartaCombate[0].vida === 0) {
        const mana = manaUser - cartaInfo[0].coste_mana
        if (mana < 0) {
          io.emit('not-enough-mana', { message: 'Not enough mana', username })
          return
        }

        console.log('Mana', mana)

        await connection.execute(
          'UPDATE cartas_combates SET vida = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
          [cartaInfo[0].vida, idCartaAttacked, combate[0].id_combate_uuid, user[0].id_uuid]
        )

        if (user[0].id_uuid === combate[0].id_user_1_uuid) {
          await connection.execute(
            'UPDATE combates SET mana_user_1 = ? WHERE BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user_1) = ?;',
            [mana, combate[0].id_combate_uuid, user[0].id_uuid]
          )
        } else if (user[0].id_uuid === combate[0].id_user_2_uuid) {
          await connection.execute(
            'UPDATE combates SET mana_user_2 = ? WHERE BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user_2) = ?;',
            [mana, combate[0].id_combate_uuid, user[0].id_uuid]
          )
        }

        await connection.execute(
          'UPDATE cartas_combates SET ataque_especial = 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
          [idCartaAttacking, combate[0].id_combate_uuid, user[0].id_uuid]
        )

        const [cartasUserInfo] = await connection.execute(
          'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
          [user[0].id_uuid, combate[0].id_combate_uuid]
        )
        const ataquesUser = []
        const cartasInfo = []
        for (const carta of cartasUserInfo) {
          const [cartaInfo] = await connection.execute('SELECT * FROM cartas WHERE id = ?', [carta.id_carta])
          const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?', [cartaInfo[0].id_ataque])
          ataquesUser.push(ataque[0])
          cartasInfo.push(cartaInfo[0])
        }

        const cartasUser = {
          cartasCombate: cartasUserInfo,
          ataques: ataquesUser,
          cartasInfo
        }

        await connection.execute(
          'UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?;',
          [opponentId, combate[0].id_combate_uuid]
        )

        io.emit('ended-turn', { username, cartas })
        io.emit('special-attacked-revive', { username, cartasUser, mana })
      }
    }
  })

  socket.on('special-attack-opponent', async (data) => {
    const idCartaAttacked = data.idCartaAttacked
    const idCartaAttacking = data.idCartaAttacking
    const username = data.username
    const idAtaque = data.idAtaque
    const tipo = data.tipo

    let opponentId
    const ataques = []
    const cartasInfo = []

    const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?;', [idAtaque])
    const [user] = await connection.execute('SELECT *, BIN_TO_UUID(id) AS id_uuid FROM users WHERE user = ?', [username])
    const [combate] = await connection.execute('SELECT *, BIN_TO_UUID(id_combate) AS id_combate_uuid, BIN_TO_UUID(id_user_1) AS id_user_1_uuid, BIN_TO_UUID(id_user_2) AS id_user_2_uuid, BIN_TO_UUID(turno) as turno_uuid FROM combates WHERE BIN_TO_UUID(id_user_1) = ? OR BIN_TO_UUID(id_user_2) = ?;', [user[0].id_uuid, user[0].id_uuid])

    if (user[0].id_uuid === combate[0].id_user_1_uuid) {
      opponentId = combate[0].id_user_2_uuid
    } else if (user[0].id_uuid === combate[0].id_user_2_uuid) {
      opponentId = combate[0].id_user_1_uuid
    }

    const [cartasCombate] = await connection.execute('SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;', [opponentId, combate[0].id_combate_uuid])
    if (cartasCombate.length === 0) {
      return
    }
    for (const cartaCombate of cartasCombate) {
      const [carta] = await connection.execute('SELECT * FROM cartas WHERE id = ?;', [cartaCombate.id_carta])
      const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?', [carta[0].id_ataque])
      ataques.push(ataque[0])
      cartasInfo.push(carta[0])
    }

    const cartas = {
      cartasInfo,
      cartasCombate,
      ataques
    }

    if (tipo === 'unico') {
      const [cartaInfo] = await connection.execute(
        'SELECT * FROM cartas WHERE id = ?;', [idCartaAttacked]
      )

      // const [cartaAttackingInfo] = await connection.execute(
      //   'SELECT * FROM cartas WHERE id = ?;', [idCartaAttacking]
      // )

      const [cartaCombate] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE id_carta = ? AND BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [idCartaAttacked, opponentId, combate[0].id_combate_uuid]
      )

      let vida = cartaCombate[0].vida - ataque[0].cambio

      if (ataque[0].nombre === 'Divine Wisdom' && cartaInfo[0].tipo === 'Darkness') {
        vida = 0
      }

      if (vida < 0) {
        vida = 0
      }

      await connection.execute(
        'UPDATE cartas_combates SET vida = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
        [vida, idCartaAttacked, combate[0].id_combate_uuid, opponentId]
      )

      let mana = 0
      if (vida === 0) {
        if (opponentId === combate[0].id_user_1_uuid) {
          mana = combate[0].mana_user_1 + cartaInfo[0].costo_mana
          await connection.execute(
            'UPDATE combates SET mana_user_1 = ? WHERE BIN_TO_UUID(id_combate) = ?;',
            [mana, combate[0].id_combate_uuid]
          )
        } else if (opponentId === combate[0].id_user_2_uuid) {
          mana = combate[0].mana_user_2 + cartaInfo[0].costo_mana
          await connection.execute(
            'UPDATE combates SET mana_user_2 = ? WHERE BIN_TO_UUID(id_combate) = ?;',
            [mana, combate[0].id_combate_uuid]
          )
        }
      }

      console.log(mana)

      await connection.execute(
        'UPDATE cartas_combates SET ataque_especial = 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
        [idCartaAttacking, combate[0].id_combate_uuid, user[0].id_uuid]
      )

      const [opponentCards] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [opponentId, combate[0].id_combate_uuid]
      )

      const [opponent] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [opponentId])

      await connection.execute(
        'UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?;',
        [opponentId, combate[0].id_combate_uuid]
      )

      io.emit('ended-turn', { username, cartas })
      io.emit('special-attacked-opponent', { opponent: opponent[0].user, opponentCards, mana })
    }

    if (tipo === 'power-down') {
      const [cartaCombate] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE id_carta = ? AND BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [idCartaAttacked, opponentId, combate[0].id_combate_uuid]
      )

      if (!cartaCombate[0].efecto_secundario) {
        let ataqueNumber = cartaCombate[0].ataque - ataque[0].cambio
        if (ataqueNumber < 0) {
          ataqueNumber = 0
        }
        await connection.execute(
          'UPDATE cartas_combates SET ataque = ?, efecto_secundario = ?, duracion_efecto = ?, estadistica_efecto = ?, cambio_estadistica = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
          [ataqueNumber, tipo, ataque[0].duracion, ataque[0].estadistica, ataque[0].cambio, idCartaAttacked, combate[0].id_combate_uuid, opponentId]
        )

        await connection.execute(
          'UPDATE cartas_combates SET ataque_especial = 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
          [idCartaAttacking, combate[0].id_combate_uuid, user[0].id_uuid]
        )
      } else {
        io.emit('already-has-effect', { message: 'Already has effect', username })
        return
      }

      const [opponentCards] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [opponentId, combate[0].id_combate_uuid]
      )
      const [opponent] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [opponentId])

      await connection.execute(
        'UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?;',
        [opponentId, combate[0].id_combate_uuid]
      )

      io.emit('ended-turn', { username, cartas })
      io.emit('special-attacked-opponent', { opponent: opponent[0].user, opponentCards })
    }

    if (tipo === 'corrosivo') {
      const [cartaCombate] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE id_carta = ? AND BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [idCartaAttacked, opponentId, combate[0].id_combate_uuid]
      )

      if (!cartaCombate[0].efecto_secundario) {
        await connection.execute(
          'UPDATE cartas_combates SET efecto_secundario = ?, duracion_efecto = ?, estadistica_efecto = ?, cambio_estadistica = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
          [tipo, ataque[0].duracion, ataque[0].estadistica, ataque[0].cambio, idCartaAttacked, combate[0].id_combate_uuid, opponentId]
        )

        await connection.execute(
          'UPDATE cartas_combates SET ataque_especial = 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
          [idCartaAttacking, combate[0].id_combate_uuid, user[0].id_uuid]
        )
      } else {
        io.emit('already-has-effect', { message: 'Already has effect', username })
        return
      }

      const [opponentCards] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [opponentId, combate[0].id_combate_uuid]
      )
      const [opponent] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [opponentId])

      await connection.execute(
        'UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?;',
        [opponentId, combate[0].id_combate_uuid]
      )

      io.emit('ended-turn', { username, cartas })
      io.emit('special-attacked-opponent', { opponent: opponent[0].user, opponentCards })
    }

    if (tipo === 'inmovil') {
      const [cartaCombate] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE id_carta = ? AND BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [idCartaAttacked, opponentId, combate[0].id_combate_uuid]
      )

      if (!cartaCombate[0].efecto_secundario) {
        await connection.execute(
          'UPDATE cartas_combates SET efecto_secundario = ?, duracion_efecto = ?, estadistica_efecto = ?, cambio_estadistica = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
          [tipo, ataque[0].duracion, ataque[0].estadistica, ataque[0].cambio, idCartaAttacked, combate[0].id_combate_uuid, opponentId]
        )

        await connection.execute(
          'UPDATE cartas_combates SET ataque_especial = 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
          [idCartaAttacking, combate[0].id_combate_uuid, user[0].id_uuid]
        )
      } else {
        io.emit('already-has-effect', { message: 'Already has effect', username })
        return
      }

      const [opponentCards] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [opponentId, combate[0].id_combate_uuid]
      )
      const [opponent] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [opponentId])

      await connection.execute(
        'UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?;',
        [opponentId, combate[0].id_combate_uuid]
      )

      io.emit('ended-turn', { username, cartas, tipo })
      io.emit('special-attacked-opponent', { opponent: opponent[0].user, opponentCards })
    }
  })

  /* Aqui se recibe la peticion de usar un ataque especial en area */
  socket.on('special-attack-area', async (data) => {
    const idCarta = data.idCartaAttacking
    const username = data.username
    const idAtaque = data.idAtaque
    const tipo = data.tipo

    const tipoSplited = tipo.split('/')
    let opponentId
    const ataques = []
    const cartasInfo = []

    const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?;', [idAtaque])
    const [user] = await connection.execute('SELECT *, BIN_TO_UUID(id) AS id_uuid FROM users WHERE user = ?', [username])
    const [combate] = await connection.execute('SELECT *, BIN_TO_UUID(id_combate) AS id_combate_uuid, BIN_TO_UUID(id_user_1) AS id_user_1_uuid, BIN_TO_UUID(id_user_2) AS id_user_2_uuid, BIN_TO_UUID(turno) as turno_uuid FROM combates WHERE BIN_TO_UUID(id_user_1) = ? OR BIN_TO_UUID(id_user_2) = ?;', [user[0].id_uuid, user[0].id_uuid])

    if (user[0].id_uuid === combate[0].id_user_1_uuid) {
      opponentId = combate[0].id_user_2_uuid
    } else if (user[0].id_uuid === combate[0].id_user_2_uuid) {
      opponentId = combate[0].id_user_1_uuid
    }

    const [opponent] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [opponentId])

    const [cartasAliadas] = await connection.execute(
      'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
      [user[0].id_uuid, combate[0].id_combate_uuid]
    )
    const [cartasOpponent] = await connection.execute(
      'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
      [opponentId, combate[0].id_combate_uuid]
    )

    const [cartasCombate] = await connection.execute('SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;', [opponentId, combate[0].id_combate_uuid])
    if (cartasCombate.length === 0) {
      return
    }
    for (const cartaCombate of cartasCombate) {
      const [carta] = await connection.execute('SELECT * FROM cartas WHERE id = ?;', [cartaCombate.id_carta])
      const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?', [carta[0].id_ataque])
      ataques.push(ataque[0])
      cartasInfo.push(carta[0])
    }

    const cartas = {
      cartasInfo,
      cartasCombate,
      ataques
    }

    let mana = 0
    if (tipo === 'area') {
      for (const carta of cartasCombate) {
        if (carta.efecto_secundario !== 'inmune') {
          let vida = carta.vida - ataque[0].cambio
          const [cartaInfo] = await connection.execute('SELECT * FROM cartas WHERE id = ?;', [carta.id_carta])
          if (vida <= 0) {
            vida = 0
            if (opponentId === combate[0].id_user_1_uuid) {
              if (carta.efecto_secundario === 'reverse') {
                await connection.execute(
                  'UPDATE cartas_combates SET ataque = ?, efecto_secundario = NULL, duracion_efecto = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
                  [cartaInfo[0].ataque, carta.id_carta, combate[0].id_combate_uuid, opponentId]
                )
              }
              mana = combate[0].mana_user_1 + cartaInfo[0].costo_mana
              await connection.execute('UPDATE combates SET mana_user_1 = ? WHERE BIN_TO_UUID(id_combate) = ?', [mana, combate[0].id_combate_uuid])
            } else if (opponentId === combate[0].id_user_2_uuid) {
              if (carta.efecto_secundario === 'reverse') {
                await connection.execute(
                  'UPDATE cartas_combates SET ataque = ?, efecto_secundario = NULL, duracion_efecto = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
                  [cartaInfo[0].ataque, carta.id_carta, combate[0].id_combate_uuid, opponentId]
                )
              }
              mana = combate[0].mana_user_2 + cartaInfo[0].costo_mana
              await connection.execute('UPDATE combates SET mana_user_2 = ? WHERE BIN_TO_UUID(id_combate) = ?', [mana, combate[0].id_combate_uuid])
            }
          }
          await connection.execute(
            'UPDATE cartas_combates SET vida = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
            [vida, carta.id_carta, combate[0].id_combate_uuid, opponentId]
          )
        }
      }
      await connection.execute(
        'UPDATE cartas_combates SET ataque_especial = 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
        [idCarta, combate[0].id_combate_uuid, user[0].id_uuid]
      )
      const [opponentCards] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
        [opponentId, combate[0].id_combate_uuid]
      )

      await connection.execute(
        'UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?',
        [opponentId, combate[0].id_combate_uuid]
      )

      io.emit('ended-turn', { username, cartas })
      io.emit('special-attacked-area', { opponent: opponent[0].user, username, opponentCards, mana })
    }

    if (tipoSplited[1] === 'area') {
      // let mana = 0

      if (tipoSplited[0] === 'power-up') {
        for (const carta of cartasAliadas) {
          const [cartaInfo] = await connection.execute('SELECT * FROM cartas WHERE id = ?;', [carta.id_carta])
          if (ataque[0].estadistica === 'vida') {
            if (!carta.efecto_secundario) {
              let vida = carta.vida + ataque[0].cambio
              if (vida > cartaInfo[0].vida) {
                vida = cartaInfo[0].vida
              }
              await connection.execute(
                'UPDATE cartas_combates SET vida = ?, efecto_secundario = ?, duracion_efecto = ?, estadistica_efecto = ?, cambio_estadistica = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
                [vida, tipoSplited[0], ataque[0].duracion, ataque[0].estadistica, ataque[0].cambio, carta.id_carta, combate[0].id_combate_uuid, user[0].id_uuid]
              )

              await connection.execute(
                'UPDATE cartas_combates SET ataque_especial = 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
                [idCarta, combate[0].id_combate_uuid, user[0].id_uuid]
              )
            } else {
              io.emit('already-has-effect', { message: 'Already has effect', username })
              return
            }
          } else if (ataque[0].estadistica === 'ataque') {
            if (!carta.efecto_secundario) {
              const ataqueNumber = carta.ataque + ataque[0].cambio
              await connection.execute(
                'UPDATE cartas_combates SET ataque = ?, efecto_secundario = ?, duracion_efecto = ?, estadistica_efecto = ?, cambio_estadistica = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
                [ataqueNumber, tipoSplited[0], ataque[0].duracion, ataque[0].estadistica, ataque[0].cambio, carta.id_carta, combate[0].id_combate_uuid, user[0].id_uuid]
              )

              await connection.execute(
                'UPDATE cartas_combates SET ataque_especial = 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
                [idCarta, combate[0].id_combate_uuid, user[0].id_uuid]
              )
            } else {
              io.emit('already-has-effect', { message: 'Already has effect', username })
              return
            }
          }
        }

        const [opponentCards] = await connection.execute('SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;', [user[0].id_uuid, combate[0].id_combate_uuid])
        const [opponent] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [opponentId])

        await connection.execute('UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?', [opponentId, combate[0].id_combate_uuid])

        io.emit('ended-turn', { username, cartas })
        io.emit('special-attacked-area', { opponent: username, username: opponent[0].user, opponentCards, mana })
      }

      if (tipoSplited[0] === 'power-down') {
        for (const carta of cartasOpponent) {
          if (!carta.efecto_secundario) {
            let ataqueNumber = carta.ataque - ataque[0].cambio
            if (ataqueNumber < 0) {
              ataqueNumber = 0
            }
            await connection.execute(
              'UPDATE cartas_combates SET ataque = ?, efecto_secundario = ?, duracion_efecto = ?, estadistica_efecto = ?, cambio_estadistica = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
              [ataqueNumber, tipoSplited[0], ataque[0].duracion, ataque[0].estadistica, ataque[0].cambio, carta.id_carta, combate[0].id_combate_uuid, opponentId]
            )

            await connection.execute(
              'UPDATE cartas_combates SET ataque_especial = 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
              [idCarta, combate[0].id_combate_uuid, user[0].id_uuid]
            )
          }
        }

        const [opponentCards] = await connection.execute(
          'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
          [opponentId, combate[0].id_combate_uuid]
        )
        const [opponent] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [opponentId])

        await connection.execute(
          'UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?',
          [opponentId, combate[0].id_combate_uuid]
        )

        io.emit('ended-turn', { username, cartas })
        io.emit('special-attacked-area', { opponent: opponent[0].user, username, opponentCards, mana })
      }

      if (tipoSplited[0] === 'inmovil') {
        for (const carta of cartasOpponent) {
          if (!carta.efecto_secundario) {
            await connection.execute(
              'UPDATE cartas_combates SET efecto_secundario = ?, duracion_efecto = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
              [tipoSplited[0], ataque[0].duracion, carta.id_carta, combate[0].id_combate_uuid, opponentId]
            )

            await connection.execute(
              'UPDATE cartas_combates SET ataque_especial = 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
              [idCarta, combate[0].id_combate_uuid, user[0].id_uuid]
            )
          } else {
            io.emit('already-has-effect', { message: 'Already has effect', username })
            return
          }

          const [opponentCards] = await connection.execute(
            'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
            [opponentId, combate[0].id_combate_uuid]
          )
          const [opponent] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [opponentId])

          await connection.execute(
            'UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?',
            [opponentId, combate[0].id_combate_uuid]
          )

          const ataquesOpponent = []
          for (const cartaCombate of opponentCards) {
            const [carta] = await connection.execute('SELECT * FROM cartas WHERE id = ?;', [cartaCombate.id_carta])
            const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?', [carta[0].id_ataque])
            ataquesOpponent.push(ataque[0])
          }

          io.emit('ended-turn', { username, cartas, tipo: tipoSplited[0] })
          io.emit('special-attacked-area', { opponent: opponent[0].user, username, opponentCards, mana, ataques: ataquesOpponent })
        }
      }

      if (tipoSplited[0] === 'corrosivo') {
        for (const carta of cartasOpponent) {
          if (!carta.efecto_secundario) {
            await connection.execute(
              'UPDATE cartas_combates SET efecto_secundario = ?, duracion_efecto = ?, estadistica_efecto = ?, cambio_estadistica = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
              [tipoSplited[0], ataque[0].duracion, ataque[0].estadistica, ataque[0].cambio, carta.id_carta, combate[0].id_combate_uuid, opponentId]
            )

            await connection.execute(
              'UPDATE cartas_combates SET ataque_especial = 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
              [idCarta, combate[0].id_combate_uuid, user[0].id_uuid]
            )
          } else {
            io.emit('already-has-effect', { message: 'Already has effect', username })
            return
          }
          const [opponentCards] = await connection.execute(
            'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;',
            [opponentId, combate[0].id_combate_uuid]
          )
          const [opponent] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [opponentId])

          await connection.execute(
            'UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?',
            [opponentId, combate[0].id_combate_uuid]
          )

          const ataquesOpponent = []
          for (const cartaCombate of opponentCards) {
            const [carta] = await connection.execute('SELECT * FROM cartas WHERE id = ?;', [cartaCombate.id_carta])
            const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?', [carta[0].id_ataque])
            ataquesOpponent.push(ataque[0])
          }

          io.emit('ended-turn', { username, cartas })
          io.emit('special-attacked-area', { opponent: opponent[0].user, username, opponentCards, mana })
        }
      }
    }
  })

  /* Aqui es cada vez que pulsan en pasar turno */
  socket.on('end-turn', async (data) => {
    const username = data.username
    const ataques = []
    const cartasInfo = []
    let cartas = []

    const [user] = await connection.execute('SELECT *, BIN_TO_UUID(id) AS id_uuid FROM users WHERE user = ?', [username])
    const [combate] = await connection.execute('SELECT *, BIN_TO_UUID(id_combate) AS id_combate_uuid, BIN_TO_UUID(id_user_1) AS id_user_1_uuid, BIN_TO_UUID(id_user_2) AS id_user_2_uuid, BIN_TO_UUID(turno) as turno_uuid FROM combates WHERE BIN_TO_UUID(id_user_1) = ? OR BIN_TO_UUID(id_user_2) = ?;', [user[0].id_uuid, user[0].id_uuid])

    if (user[0].id_uuid === combate[0].id_user_1_uuid) {
      const [cartasUser1] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?',
        [combate[0].id_user_1_uuid, combate[0].id_combate_uuid]
      )

      for (const carta of cartasUser1) {
        const [cartaInfo] = await connection.execute('SELECT * FROM cartas WHERE id = ?', [carta.id_carta])

        if (carta.duracion_efecto <= 1 && carta.efecto_secundario) {
          // Efecto está a punto de finalizar
          // Efecto de subir o bajar el ataque
          if (carta.estadistica_efecto === 'ataque') {
            await connection.execute(
              'UPDATE cartas_combates SET ataque = ?, efecto_secundario = NULL, duracion_efecto = NULL, estadistica_efecto = NULL, cambio_estadistica = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
              [cartaInfo[0].ataque, carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_1_uuid] // Asegúrate del id_user correcto
            )
          // Efecto de bajar la vida como un veneno
          } else if (carta.efecto_secundario === 'corrosivo') {
            let vida = carta.vida - carta.cambio_estadistica
            if (vida < 0) {
              vida = 0
              if (cartaInfo.efecto_secundario === 'reverse') {
                await connection.execute(
                  'UPDATE cartas_combates SET ataque = ?, efecto_secundario = NULL, duracion_efecto = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
                  [cartaInfo[0].ataque, carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_1_uuid]
                )
              }
            }
            await connection.execute(
              'UPDATE cartas_combates SET vida = ?, efecto_secundario = NULL, duracion_efecto = NULL, estadistica_efecto = NULL, cambio_estadistica = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
              [vida, carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_1_uuid] // Asegúrate del id_user correcto
            )
          // Efecto de intercambiar la vida por el ataque
          } else if (carta.efecto_secundario === 'reverse') {
            await connection.execute(
              'UPDATE cartas_combates SET ataque = ?, vida = ?, efecto_secundario = NULL, duracion_efecto = NULL, estadistica_efecto = NULL, cambio_estadistica = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
              [carta.vida, carta.ataque, carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_1_uuid] // Asegúrate del id_user correcto
            )
          } else {
            await connection.execute(
              'UPDATE cartas_combates SET efecto_secundario = NULL, duracion_efecto = NULL, estadistica_efecto = NULL, cambio_estadistica = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
              [carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_1_uuid] // Asegúrate del id_user correcto
            )
          }
        } else if (carta.duracion_efecto && carta.duracion_efecto > 1) {
          // Efecto sigue activo
          if (carta.efecto_secundario === 'corrosivo') {
            let vida = carta.vida - carta.cambio_estadistica
            if (vida < 0) {
              vida = 0
              if (cartaInfo.efecto_secundario === 'reverse') {
                await connection.execute(
                  'UPDATE cartas_combates SET ataque = ?, efecto_secundario = NULL, duracion_efecto = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
                  [cartaInfo[0].ataque, carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_1_uuid]
                )
              }
            }
            await connection.execute(
              'UPDATE cartas_combates SET duracion_efecto = duracion_efecto - 1, vida = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
              [vida, carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_1_uuid] // Asegúrate del id_user correcto
            )
          } else {
            await connection.execute(
              'UPDATE cartas_combates SET duracion_efecto = duracion_efecto - 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
              [carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_1_uuid] // Asegúrate del id_user correcto
            )
          }
        }
      }
    }

    if (user[0].id_uuid === combate[0].id_user_2_uuid) {
      const [cartasUser2] = await connection.execute(
        'SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?',
        [combate[0].id_user_2_uuid, combate[0].id_combate_uuid]
      )

      for (const carta of cartasUser2) {
        const [cartaInfo] = await connection.execute('SELECT * FROM cartas WHERE id = ?', [carta.id_carta])

        if (carta.duracion_efecto && carta.duracion_efecto <= 1) {
          // Efecto está a punto de finalizar
          if (carta.efecto_secundario) {
            if (carta.estadistica_efecto === 'ataque') {
              await connection.execute(
                'UPDATE cartas_combates SET ataque = ?, efecto_secundario = NULL, duracion_efecto = NULL, estadistica_efecto = NULL, cambio_estadistica = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
                [cartaInfo[0].ataque, carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_2_uuid]
              )
            } else if (carta.efecto_secundario === 'corrosivo') {
              let vida = carta.vida - carta.cambio_estadistica
              if (vida < 0) {
                vida = 0
                if (cartaInfo.efecto_secundario === 'reverse') {
                  await connection.execute(
                    'UPDATE cartas_combates SET ataque = ?, efecto_secundario = NULL, duracion_efecto = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
                    [cartaInfo[0].ataque, carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_2_uuid]
                  )
                }
              }
              await connection.execute(
                'UPDATE cartas_combates SET vida = ?, efecto_secundario = NULL, duracion_efecto = NULL, estadistica_efecto = NULL, cambio_estadistica = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
                [vida, carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_2_uuid]
              )
            } else {
              await connection.execute(
                'UPDATE cartas_combates SET efecto_secundario = NULL, duracion_efecto = NULL, estadistica_efecto = NULL, cambio_estadistica = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
                [carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_2_uuid]
              )
            }
          }
        } else if (carta.duracion_efecto && carta.duracion_efecto > 1) {
          // Efecto sigue activo
          if (carta.efecto_secundario === 'corrosivo') {
            let vida = carta.vida - carta.cambio_estadistica
            if (vida < 0) {
              vida = 0
              if (cartaInfo.efecto_secundario === 'reverse') {
                await connection.execute(
                  'UPDATE cartas_combates SET ataque = ?, efecto_secundario = NULL, duracion_efecto = NULL WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?;',
                  [cartaInfo[0].ataque, carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_2_uuid]
                )
              }
            }
            await connection.execute(
              'UPDATE cartas_combates SET duracion_efecto = duracion_efecto - 1, vida = ? WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
              [vida, carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_2_uuid]
            )
          } else {
            await connection.execute(
              'UPDATE cartas_combates SET duracion_efecto = duracion_efecto - 1 WHERE id_carta = ? AND BIN_TO_UUID(id_combate) = ? AND BIN_TO_UUID(id_user) = ?',
              [carta.id_carta, combate[0].id_combate_uuid, combate[0].id_user_2_uuid]
            )
          }
        }
      }
    }

    if (user[0].id_uuid === combate[0].id_user_1_uuid) {
      await connection.execute('UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?', [combate[0].id_user_2_uuid, combate[0].id_combate_uuid])
      const [cartasCombate] = await connection.execute('SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;', [combate[0].id_user_2_uuid, combate[0].id_combate_uuid])
      for (const cartaCombate of cartasCombate) {
        const [carta] = await connection.execute('SELECT * FROM cartas WHERE id = ?;', [cartaCombate.id_carta])
        const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?', [carta[0].id_ataque])
        ataques.push(ataque[0])
        cartasInfo.push(carta[0])
      }

      cartas = {
        cartasInfo,
        cartasCombate,
        ataques
      }
    } else if (user[0].id_uuid === combate[0].id_user_2_uuid) {
      await connection.execute('UPDATE combates SET turno = UUID_TO_BIN(?) WHERE BIN_TO_UUID(id_combate) = ?', [combate[0].id_user_1_uuid, combate[0].id_combate_uuid])
      const [cartasCombate] = await connection.execute('SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;', [combate[0].id_user_1_uuid, combate[0].id_combate_uuid])

      for (const cartaCombate of cartasCombate) {
        const [carta] = await connection.execute('SELECT * FROM cartas WHERE id = ?;', [cartaCombate.id_carta])
        const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?', [carta[0].id_ataque])
        ataques.push(ataque[0])
        cartasInfo.push(carta[0])
      }

      cartas = {
        cartasInfo,
        cartasCombate,
        ataques
      }
    }

    io.emit('ended-turn', { username, cartas })
  })

  socket.on('leave-match', async (data) => {
    const username = data.username
    const [user] = await connection.execute('SELECT *, BIN_TO_UUID(id) AS id_uuid FROM users WHERE user = ?', [username])
    const [combate] = await connection.execute('SELECT *, BIN_TO_UUID(id_combate) AS id_combate_uuid, BIN_TO_UUID(id_user_1) AS id_user_1_uuid, BIN_TO_UUID(id_user_2) AS id_user_2_uuid FROM combates WHERE BIN_TO_UUID(id_user_1) = ? OR BIN_TO_UUID(id_user_2) = ?;', [user[0].id_uuid, user[0].id_uuid])

    let idOpponent
    if (combate[0].id_user_1_uuid === user[0].id_uuid) {
      idOpponent = combate[0].id_user_2_uuid
    } else {
      idOpponent = combate[0].id_user_1_uuid
    }
    const [opponent] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [idOpponent])

    if (combate[0].id_user_1 === user[0].id_uuid) {
      await connection.execute('UPDATE users SET fighting = 0 WHERE BIN_TO_UUID(id) = ?', [combate[0].id_user_2])
    } else {
      await connection.execute('UPDATE users SET fighting = 0 WHERE BIN_TO_UUID(id) = ?', [combate[0].id_user_1])
    }

    await connection.execute('DELETE FROM cartas_combates WHERE BIN_TO_UUID(id_combate) = ?', [combate[0].id_combate_uuid])

    await connection.execute('DELETE FROM combates WHERE BIN_TO_UUID(id_combate) = ?', [combate[0].id_combate_uuid])

    io.emit('left-match', { username, opponent: opponent[0].user })
  })

  socket.on('disconnect', () => {
    console.log('User disconnected')
  })
})

app.get('/checkUser', async (req, res) => {
  try {
    const username = req.query.username
    const password = req.query.password
    const [user] = await connection.execute('SELECT *, BIN_TO_UUID(id) AS id_uuid FROM users WHERE user = ?', [username])
    if (user.length > 0) {
      bcrypt.compare(password, user[0].password, async (err, result) => {
        if (err) {
          throw err
        }
        if (result) {
          const [combat] = await connection.execute('SELECT BIN_TO_UUID(id_combate) AS id FROM combates WHERE BIN_TO_UUID(id_user_1) = ? OR BIN_TO_UUID(id_user_2) = ?', [user[0].id_uuid, user[0].id_uuid])
          if (combat.length > 0) {
            return res.status(200).json({ message: 'userExists', user: user[0], combat: combat[0].id })
          } else {
            return res.status(200).json({ message: 'userExists', user: user[0] })
          }
        } else {
          return res.status(200).json({ message: 'Password does not match' })
        }
      })
    } else {
      return res.status(200).json({ message: 'userNotExists' })
    }
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
})

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
  const [shop] = await connection.execute('SELECT * FROM mercado_cartas WHERE BIN_TO_UUID(id_user) != ?;', [id])

  const arrayCartas = []
  for (const carta of shop) {
    const [card] = await connection.execute('SELECT * FROM cartas WHERE id = ?;', [carta.id_carta])
    const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?;', [card[0].id_ataque])

    arrayCartas.push({
      id: carta.id_carta_mercado,
      carta: card[0],
      ataque: ataque[0],
      precio: carta.precio
    })
  }
  return res.status(200).json(arrayCartas)
})

app.get('/filterMarket', async (req, res) => {
  const id = req.query.id
  const name = req.query.name
  const quality = req.query.quality
  const type = req.query.type

  const [shop] = await connection.execute('SELECT * FROM mercado_cartas WHERE BIN_TO_UUID(id_user) != ?;', [id])

  const arrayCartas = []
  for (const carta of shop) {
    let query = 'SELECT * FROM cartas WHERE id = ?'
    const params = [carta.id_carta]

    if (name !== '---') {
      query += ' AND nombre LIKE ?'
      params.push(`%${name}%`)
    }

    if (quality !== 'none') {
      query += ' AND rareza = ?'
      params.push(quality)
    }

    if (type !== 'none') {
      query += ' AND tipo = ?'
      params.push(type)
    }

    const [card] = await connection.execute(query, params)
    if (card.length > 0) {
      const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?;', [card[0].id_ataque])
      arrayCartas.push({
        id: carta.id_carta_mercado,
        carta: card[0],
        ataque: ataque[0],
        precio: carta.precio
      })
    }
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

app.get('/battle', async (req, res) => {
  if (!req.query.id) return res.status(404)
  const id = req.query.id

  const [combate] = await connection.execute('SELECT * FROM combates WHERE BIN_TO_UUID(id_combate) = ?;', [id])
  if (combate.length === 0) {
    return res.status(404)
  }
  res.header('Allow-Control-Allow-Origin', '*')
  res.sendFile(join(__dirname, '/web/battle.html'))
})

app.get('/getCardsBattle', async (req, res) => {
  try {
    const id = req.query.id
    let opponentId

    const [user] = await connection.execute('SELECT *, BIN_TO_UUID(id) AS id_uuid FROM users WHERE BIN_TO_UUID(id) = ?;', [id])

    const [combate] = await connection.execute('SELECT *, BIN_TO_UUID(id_combate) AS id_combate_uuid, BIN_TO_UUID(id_user_1) AS id_user_1_uuid, BIN_TO_UUID(id_user_2) AS id_user_2_uuid, BIN_TO_UUID(turno) as turno_uuid FROM combates WHERE BIN_TO_UUID(id_user_1) = ? OR BIN_TO_UUID(id_user_2) = ?;', [id, id])
    if (combate[0].id_user_1_uuid === id) {
      opponentId = combate[0].id_user_2_uuid
    } else {
      opponentId = combate[0].id_user_1_uuid
    }

    const [cartasCombatesUser] = await connection.execute('SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;', [id, combate[0].id_combate_uuid])
    const cartasEnCombateUser = []
    const idCartasUser = cartasCombatesUser.map(carta => carta.id_carta)
    for (const carta of cartasCombatesUser) {
      const [cartaEnCombateUser] = await connection.execute('SELECT * FROM cartas WHERE id = ?', [carta.id_carta])
      const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?', [cartaEnCombateUser[0].id_ataque])
      cartasEnCombateUser.push({
        cartaCombate: carta,
        cartaEnCombateUser: cartaEnCombateUser[0],
        ataque: ataque[0]
      })
    }

    const [cartasCombatesOpponent] = await connection.execute('SELECT * FROM cartas_combates WHERE BIN_TO_UUID(id_user) = ? AND BIN_TO_UUID(id_combate) = ?;', [opponentId, combate[0].id_combate_uuid])
    const cartasEnCombateOpponent = []
    for (const carta of cartasCombatesOpponent) {
      const [cartaEnCombateOpponent] = await connection.execute('SELECT * FROM cartas WHERE id = ?', [carta.id_carta])
      const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?', [cartaEnCombateOpponent[0].id_ataque])
      cartasEnCombateOpponent.push({
        cartaCombate: carta,
        cartaEnCombateOpponent: cartaEnCombateOpponent[0],
        ataque: ataque[0]
      })
    }

    const cartasCombates = {
      cartasUser: cartasEnCombateUser,
      cartasOpponent: cartasEnCombateOpponent
    }

    const [opponentUser] = await connection.execute('SELECT *, BIN_TO_UUID(id) AS id_uuid FROM users WHERE BIN_TO_UUID(id) = ?;', [opponentId])

    const [mazo] = await connection.execute('SELECT * FROM mazos WHERE BIN_TO_UUID(id_user) = ? AND numero = ?;', [id, user[0].mazo_seleccionado])

    const [mazoCartas] = await connection.execute('SELECT * FROM mazo_cartas WHERE id_mazo = ?;', [mazo[0].id])

    const userDeckCards = []
    for (const mazoCarta of mazoCartas) {
      if (!idCartasUser.includes(mazoCarta.id_carta)) {
        const [carta] = await connection.execute('SELECT * FROM cartas WHERE id = ?;', [mazoCarta.id_carta])

        const [ataque] = await connection.execute('SELECT * FROM ataques WHERE id = ?;', [carta[0].id_ataque])

        userDeckCards.push({
          carta: carta[0],
          ataque: ataque[0]
        })
      }
    }

    let manaInUse = 0
    for (const carta of cartasCombates.cartasUser) {
      manaInUse += carta.cartaEnCombateUser.costo_mana
    }
    manaInUse = 16 - manaInUse

    if (manaInUse !== 0) {
      if (id === combate[0].id_user_1_uuid) {
        if (combate[0].mana_user_1 !== manaInUse) {
          await connection.execute('UPDATE combates SET mana_user_1 = ? WHERE BIN_TO_UUID(id_combate) = ?;', [manaInUse, combate[0].id_combate_uuid])
        }
      } else if (id === combate[0].id_user_2_uuid) {
        if (combate[0].mana_user_2 !== manaInUse) {
          await connection.execute('UPDATE combates SET mana_user_2 = ? WHERE BIN_TO_UUID(id_combate) = ?;', [manaInUse, combate[0].id_combate_uuid])
        }
      }
    }

    const data = {
      userDeckCards,
      user: user[0],
      opponent: opponentUser[0],
      cartasCombates,
      combate: combate[0]
    }

    return res.status(200).json(data)
  } catch (err) {
    console.error(err)
  }
})

/* SOLICITUDES POST */

app.post('/login', async (req, res) => {
  try {
    const { usernameLogin, passwordLogin } = req.body
    const [rows] = await connection.execute('SELECT BIN_TO_UUID(id) AS id, first_log, password FROM users WHERE user = ?', [usernameLogin])
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
    subject: 'Restore password',
    text: `Change your password in the following link: https://chamous.games/change?id=${users[0].id}`
  }
  sendEmail(request, response)
  return res.status(200).json({ message: 'changed' })
})

app.post('/change-password', async (req, res) => {
  const { id, newPassword, newPasswordR } = req.body

  if (newPassword !== newPasswordR) {
    return res.status(200).json({ message: 'samePwd' })
  }

  const [user] = await connection.execute('SELECT password FROM users WHERE BIN_TO_UUID(id) = ?', [id])

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

    await connection.execute('INSERT INTO mercado_cartas (id_user, id_carta, precio) VALUES (UUID_TO_BIN(?), ?, ?)', [id, idCarta, precio])
    return res.status(200).json({ message: 'Uploaded into the market' })
  } catch (err) {
    console.error(err)
  }
})

app.post('/confirmBuy', async (req, res) => {
  try {
    const id = req.body.id
    const idCarta = req.body.idCarta
    const precio = req.body.precio
    const [user] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [id])
    const [userCard] = await connection.execute('SELECT * FROM users_cartas WHERE id_carta = ? AND id_user = UUID_TO_BIN(?)', [idCarta, id])
    if (user[0].oro < precio) {
      return res.status(200).json({ message: 'Not enough gold' })
    }

    if (userCard.length > 0) {
      return res.status(200).json({ message: 'Card in possession' })
    }

    return res.status(200).json({ message: 'Enough gold' })
  } catch (err) {
    console.error(err)
  }
})

app.post('/buyCard', async (req, res) => {
  try {
    const id = req.body.id
    const idMercado = req.body.idMercado
    const idCarta = req.body.idCarta
    const precio = req.body.precio

    await connection.execute('UPDATE users SET oro = oro - ? WHERE BIN_TO_UUID(id) = ?', [precio, id])

    const [mercado] = await connection.execute('SELECT *, BIN_TO_UUID(id_user) AS id_user_uuid FROM mercado_cartas WHERE id_carta_mercado = ?', [idMercado])
    const [user] = await connection.execute('SELECT *, BIN_TO_UUID(id) AS id_uuid FROM users WHERE BIN_TO_UUID(id) = ?', [mercado[0].id_user_uuid])

    await connection.execute('UPDATE users SET oro = oro + ? WHERE BIN_TO_UUID(id) = ?', [precio, user[0].id_uuid])
    await connection.execute('DELETE FROM mercado_cartas WHERE id_carta_mercado = ?', [idMercado])
    await connection.execute('INSERT INTO users_cartas (id_user, id_carta) VALUES (UUID_TO_BIN(?), ?)', [id, idCarta])

    return res.status(200).json({ message: 'Card bought' })
  } catch (err) {
    console.error(err)
  }
})

app.post('/buyChest', async (req, res) => {
  try {
    const id = req.body.id
    const precio = req.body.precio
    const cantidad = req.body.cantidad
    const [user] = await connection.execute('SELECT * FROM users WHERE BIN_TO_UUID(id) = ?', [id])
    if (user[0].oro < precio) {
      return res.status(200).json({ message: 'Not enough gold' })
    }
    await connection.execute('UPDATE users SET oro = oro - ?, sobres = sobres + ? WHERE BIN_TO_UUID(id) = ?', [precio, cantidad, id])
    return res.status(200).json({ message: 'Chest bought' })
  } catch (e) {
    console.error(e)
  }
})

const PORT = process.env.PORT ?? 1234
const HOST = '0.0.0.0'

app.use(express.static(join(__dirname, 'web')))

server.listen(PORT, HOST, () => {
  console.log(`Listening from https://chamous.games:${PORT}/`)
})
