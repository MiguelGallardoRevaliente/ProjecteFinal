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
const inventoryCards = document.getElementById('inventory')
const inventoryChests = document.getElementById('chests')

const changeFoto = document.getElementById('changeFoto')

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
  inventoryCards.style.display = 'block'
  inventoryChests.style.display = 'none'
}

function mostrarInventoryChests () {
  inventoryCards.style.display = 'none'
  inventoryChests.style.display = 'block'
}

document.addEventListener('click', function(event) {
  // Verificar si el clic no proviene de userFoto ni de changeFoto
  if (event.target !== userFoto && event.target !== changeFoto) {
      // Ocultar el elemento con ID 'changeFoto'
      changeFoto.style.display = 'none';
  }
});

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
