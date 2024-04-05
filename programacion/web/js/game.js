/* eslint-disable no-unused-vars */
// DEJAR DE MOSTRAR UN DIV #HOME
const home = document.getElementById('home')
const information = document.getElementById('information')
const inventory = document.getElementById('inventory')
const shop = document.getElementById('shop')
const settings = document.getElementById('settings')

function mostrarInformation () {
  home.style.display = 'none'
  shop.style.display = 'none'
  information.style.display = 'block'
}

async function mostrarInventory () {
  const yourCards = document.getElementsByClassName('yourCards')[0]
  yourCards.innerHTML = ''
  fetch('http://13.53.190.234/cards', {
    method: 'GET'
  })
    .then(response => response.json())
    .then(data => {
      console.log(data)
      data.forEach(card => {
        const cardDiv = document.createElement('div')
        cardDiv.className = 'carta'
        cardDiv.style.backgroundImage = `url(${card.foto})`
        const nombreCarta = document.createElement('p')
        nombreCarta.className = 'nombreCarta'
        nombreCarta.innerHTML = card.nombre
        const ataqueVida = document.createElement('p')
        ataqueVida.className = 'ataque-vida'
        ataqueVida.innerHTML = card.ataque + '/' + card.vida
        cardDiv.appendChild(nombreCarta)
        cardDiv.appendChild(ataqueVida)
        yourCards.appendChild(cardDiv)
      })
    })
}

function mostrarShop () {
  home.style.display = 'none'
  information.style.display = 'none'
  shop.style.display = 'block'
  settings.style.display = 'none'
  const yourCards = document.getElementsByClassName('yourCards')[0]
  yourCards.innerHTML = ''
}

function mostrarHome () {
  information.style.display = 'none'
  shop.style.display = 'none'
  home.style.display = 'block'
  settings.style.display = 'none'
  const yourCards = document.getElementsByClassName('yourCards')[0]
  yourCards.innerHTML = ''
}

function mostrarSettings () {
  home.style.display = 'none'
  information.style.display = 'none'
  inventory.style.display = 'none'
  shop.style.display = 'none'
  settings.style.display = 'block'
  const yourCards = document.getElementsByClassName('yourCards')[0]
  yourCards.innerHTML = ''
}

// FUNCION PARA CAMBIAR DE PAGINA EN "SHOP"
const shopcards = document.getElementById('shop_cards')
const shopchests = document.getElementById('shop_chests')
const allcards = document.getElementById('allcards')

function mostrarShopCards () {
  allcards.style.display = 'block'
  allchests.style.display = 'none'
  shopchests.style.boxShadow = '1px 1px 5px black inset'
  shopcards.style.boxShadow = '1px 1px 5px black'
  shopcards.style.backgroundColor = 'gray'
  shopchests.style.backgroundColor = '#292929'
}

function mostrarShopChests () {
  allcards.style.display = 'none'
  allchests.style.display = 'block'
  shopcards.style.boxShadow = '1px 1px 5px black inset'
  shopchests.style.boxShadow = '1px 1px 5px black'
  shopchests.style.backgroundColor = 'gray'
  shopcards.style.backgroundColor = '#292929'
}

document.addEventListener('DOMContentLoaded', function () {
  var audio = document.getElementById('audio')
  var volumeControl = document.getElementById('volumeControl')

  audio.volume = volumeControl.value / 100

  volumeControl.addEventListener('input', function () {
    audio.volume = volumeControl.value / 100
  })
})

var botones = document.querySelectorAll('button')

function reproducirSonido () {
  var audioClick = new Audio('img/click.mp3')
  audioClick.play()
}

botones.forEach(function (boton) {
  boton.addEventListener('click', function () {
    reproducirSonido()
  })
})

var otrosElementos = document.querySelectorAll('.otroElemento')
otrosElementos.forEach(function (elemento) {
  elemento.addEventListener('click', function () {
    reproducirSonido()
  })
})
