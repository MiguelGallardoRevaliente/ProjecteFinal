/* eslint-disable no-unused-vars */
// DEJAR DE MOSTRAR UN DIV #HOME
const home = document.getElementById('home')
const information = document.getElementById('information')
const inventory = document.getElementById('inventory')
const shop = document.getElementById('shop')
const settings = document.getElementById('settings')

// FUNCION PARA CAMBIAR DE PAGINA EN "SHOP"
const shopcards = document.getElementById('shop_cards')
const shopchests = document.getElementById('shop_chests')
const allcards = document.getElementById('allcards')


// FUNCION PARA CAMBIAR DE PAGINA EN "INVENTORY"
const inventoryCards = document.getElementsByClassName('allcards')
const inventoryChests = document.getElementsByClassName('allchests')
const inventoryMazos = document.getElementById('allmazos')

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

function mostrarInventoryCards () {
  inventoryMazos.style.display = 'none'
  inventoryChests.style.display = 'none'
  inventoryCards.style.display = 'block'
  inventoryCards.style.backgroundColor = 'gray'
  inventoryChests.style.backgroundColor = '#292929'
  inventoryMazos.style.backgroundColor = '#292929'
}

function mostrarInventoryChests () {
  inventoryMazos.style.display = 'none'
  inventoryCards.style.display = 'none'
  inventoryChests.style.display = 'block'
  inventoryChests.style.backgroundColor = 'gray'
  inventoryCards.style.backgroundColor = '#292929'
  inventoryMazos.style.backgroundColor = '#292929'
}

function mostrarInventoryMazos () {
  inventoryCards.style.display = 'none'
  inventoryChests.style.display = 'none'
  inventoryMazos.style.display = 'block'
  inventoryMazos.style.backgroundColor = 'gray'
  inventoryCards.style.backgroundColor = '#292929'
  inventoryChests.style.backgroundColor = '#292929'
}


document.addEventListener('DOMContentLoaded', function () {
  const audio = document.getElementById('audio')
  const volumeControl = document.getElementById('volumeControl')

  audio.volume = volumeControl.value / 100

  volumeControl.addEventListener('input', function () {
    audio.volume = volumeControl.value / 100
  })
})

const botones = document.querySelectorAll('button')

function reproducirSonido () {
  const audioClick = new Audio('img/click.mp3')
  audioClick.play()
}

botones.forEach(function (boton) {
  boton.addEventListener('click', function () {
    reproducirSonido()
  })
})

const otrosElementos = document.querySelectorAll('.otroElemento')
otrosElementos.forEach(function (elemento) {
  elemento.addEventListener('click', function () {
    reproducirSonido()
  })
})
