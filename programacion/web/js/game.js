/* eslint-disable no-undef */
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
const allchests = document.getElementById('allchests')
// FUNCION PARA CAMBIAR DE PAGINA EN "INVENTORY"
const inventoryCards = document.getElementById('inventory')
const inventoryChests = document.getElementById('chests')
const inventoryMazos = document.getElementById('mazos')

const changeFoto = document.getElementById('changeFoto')

const sobresGod = document.getElementById('sobres_god')

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

function mostrarSobreGod () {
  sobresGod.style.display = 'block'
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

const setProfilePicture = (event) => {
  const userFoto = document.getElementById('userFoto')
  userFoto.src = event.target.src
  console.log(event.target.src)
  const idUser = localStorage.getItem('id')
  document.getElementById('changeFoto').style.display = 'none'
  fetch('/changeProfilePicture', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ profilePicture: event.target.src, id: idUser })
  })
    .then(response => response.json())
    .then(data => console.log(data))
}

function getCartas (mazoActual) {
  const cartasNoMazo = document.getElementById('cartas-no-mazo')
  cartasNoMazo.style.display = 'grid'
  fetch(`/getCardsDeck?mazo=${mazoActual}`, {
    method: 'GET'
  })
    .then(response => response.json())
    .then(data => {
      console.log(data)
    })
}

function mazoAtras () {
  const mazo = document.getElementsByClassName('mazo')
  if (mazo[0].style.display !== 'grid') {
    const mazoActual = document.getElementsByClassName('mazoActual')[0]
    const nuevoMazo = parseInt(mazoActual.textContent) - 1
    mazoActual.textContent = nuevoMazo
    mazo[nuevoMazo - 1].style.display = 'grid'
    mazo[nuevoMazo].style.display = 'none'
  }
}

function siguienteMazo () {
  const mazo = document.getElementsByClassName('mazo')
  if (mazo[2].style.display !== 'grid') {
    const mazoActual = document.getElementsByClassName('mazoActual')[0]
    const nuevoMazo = parseInt(mazoActual.textContent) + 1
    mazoActual.textContent = nuevoMazo
    mazo[nuevoMazo - 1].style.display = 'grid'
    mazo[nuevoMazo - 2].style.display = 'none'
  }
}
