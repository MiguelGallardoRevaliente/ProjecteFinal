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

const resultadoSobre = document.getElementsByClassName('resultado_sobre')

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

function salirResultadoSobre () {
  innerHTML = ''
  resultadoSobre.style.display = 'none'
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
  const cartas = document.getElementsByClassName('cartas')[0]
  cartasNoMazo.style.display = 'flex'
  cartas.innerHTML = ''
  fetch(`/getCardsDeck?mazo=${mazoActual}`, {
    method: 'GET'
  })
    .then(response => response.json())
    .then(data => {
      console.log(data)
      const length = data.filteredCards.length
      for (let i = 0; i < length; i++) {
        const card = data.filteredCards[i]

        const cardDiv = document.createElement('div')
        cardDiv.className = 'carta'
        cardDiv.style.backgroundImage = `url(${card.foto})`

        const nombreCarta = document.createElement('p')
        nombreCarta.className = 'nombreCarta'
        nombreCarta.innerHTML = card.nombre

        const ataqueVida = document.createElement('p')
        ataqueVida.className = 'ataque-vida'
        ataqueVida.innerHTML = card.ataque + '/' + card.vida

        const ataqueEspecial = document.createElement('p')
        ataqueEspecial.className = 'ataque-especial'
        const textoAtaqueEspecial = data.ataques[i][0].nombre + ' - ' + data.ataques[i][0].descripcion
        ataqueEspecial.innerHTML = textoAtaqueEspecial

        cardDiv.appendChild(nombreCarta)
        cardDiv.appendChild(ataqueEspecial)
        cardDiv.appendChild(ataqueVida)
        cartas.appendChild(cardDiv)
      }
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
