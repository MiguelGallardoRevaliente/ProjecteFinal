/* eslint-disable no-unused-vars */
import { io } from 'https://cdn.socket.io/4.7.5/socket.io.esm.min.js'

const socket = io()

function dragStart (event) {
  event.dataTransfer.setData('text', event.target.id)
  console.log(event.target.id)
}

function drop (event) {
  event.preventDefault()
  const data = event.dataTransfer.getData('text')
  console.log(data)
  const user = localStorage.getItem('username')

  socket.emit('playCard', { id: data, user })

  socket.on('played-card', (data) => {
    console.log(data)
    // Hacer que se muestre la carta en el board del user
  })

  socket.on('not-in-match', () => {
    console.log('You are not in a match')
  })

  socket.on('card-not-deck', () => {
    console.log('You do not have that card in your deck')
  })

  socket.on('not-your-turn', () => {
    console.log('It is not your turn')
    // Hay que hacer la comprovacion de los turnos y el cambio entre estos
  })
}

function dragOver (event) {
  event.preventDefault()
}

document.addEventListener('DOMContentLoaded', function() {
  const cardDivs = document.querySelectorAll('.card')
  cardDivs.forEach(cardDiv => {
    cardDiv.addEventListener('dragstart', dragStart)
  })
})
