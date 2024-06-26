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
const titul = document.getElementById('titul')
const allcards = document.getElementById('allcards')
const allchests = document.getElementById('allchests')
// FUNCION PARA CAMBIAR DE PAGINA EN "INVENTORY"
const inventoryCards = document.getElementById('inventory')
const inventoryChests = document.getElementById('chests')
const inventoryMazos = document.getElementById('mazos')

const changeFoto = document.getElementById('changeFoto')

const sobresGod = document.getElementById('sobres_god')

const resultadoSobre = document.getElementsByClassName('resultado_sobre')
const header = document.getElementById('header')
const closeHeader = document.getElementById('close-header')
const openHeader = document.getElementById('open-header')

const putOnMarketClass = document.getElementsByClassName('put_on_market')[0]

/* Funcion para cerrar el cuadro de añadir una carta al mercado */
function closePutOnMarket () {
  const inputRareza = document.getElementById('rareza')
  inputRareza.remove()
  const inputIdCarta = document.getElementById('idCarta')
  inputIdCarta.remove()
  const precio = document.getElementById('precio')
  precio.value = ''
  const maxAndMin = document.getElementById('maxAndMin')
  maxAndMin.innerHTML = ''
  putOnMarketClass.style.display = 'none'
}

/* Funcion para mostrar el header en responsive */
function mostrarHeader () {
  header.style.display = 'flex'
  closeHeader.style.display = 'block'
  openHeader.style.display = 'none'
}

/* Funcion para cerrar el header en responsive */
function cerrarHeader () {
  header.style.display = 'none'
  closeHeader.style.display = 'none'
  openHeader.style.display = 'block'
}

/* Funcion para mostrar el mercado de cartas */
function mostrarShopCards () {
  allcards.style.display = 'block'
  allchests.style.display = 'none'
  shopchests.style.boxShadow = '1px 1px 5px black inset'
  shopcards.style.boxShadow = '1px 1px 5px black'
  shopcards.style.backgroundColor = 'gray'
  shopchests.style.backgroundColor = '#292929'
  document.getElementById('titul').innerText = 'MARKET'
}

/* Funcion para obtener todas las ofertas en la tienda de sobres */
function mostrarShopChests () {
  allcards.style.display = 'none'
  allchests.style.display = 'block'
  shopcards.style.boxShadow = '1px 1px 5px black inset'
  shopchests.style.boxShadow = '1px 1px 5px black'
  shopchests.style.backgroundColor = 'gray'
  shopcards.style.backgroundColor = '#292929'
  document.getElementById('titul').innerText = 'SHOP'

  allchests.innerHTML = ''
  fetch('/getShopChests', {
    method: 'GET'
  })
    .then(response => response.json())
    .then(data => {
      data.forEach(chest => {
        const chestDiv = document.createElement('div')
        chestDiv.className = 'chest'
        chestDiv.style.backgroundImage = 'url(img/sobre.png)'

        const infoDiv = document.createElement('div')
        infoDiv.className = 'info'
        const cantidad = document.createElement('p')
        cantidad.className = 'cantidad'
        cantidad.innerHTML = 'Quantity: ' + chest.cantidad

        const precioDiv = document.createElement('div')
        const precio = document.createElement('p')
        precio.className = 'precio'
        precio.innerHTML = chest.precio
        const rubiImg = document.createElement('img')
        rubiImg.src = 'img/rubi.png'
        rubiImg.alt = 'rubi'

        const comprarButton = document.createElement('button')
        comprarButton.textContent = 'Buy'
        comprarButton.className = 'comprar_chest'
        comprarButton.setAttribute('onclick', `comprarChest(${chest.precio}, ${chest.cantidad})`)

        const precioCantidadDiv = document.createElement('div')
        precioCantidadDiv.className = 'precio-cantidad'

        precioDiv.appendChild(precio)
        precioDiv.appendChild(rubiImg)

        precioCantidadDiv.appendChild(cantidad)
        precioCantidadDiv.appendChild(precioDiv)
        infoDiv.appendChild(precioCantidadDiv)
        infoDiv.appendChild(comprarButton)

        chestDiv.appendChild(infoDiv)
        allchests.appendChild(chestDiv)
      })
    })
}

function mostrarSobreGod () {
  sobresGod.style.display = 'block'
}

function salirResultadoSobre () {
  innerHTML = ''
  resultadoSobre.style.display = 'none'
}

/* Funcion para actualizar la foto de perfil del usuario */
const setProfilePicture = (event) => {
  const userFoto = document.getElementById('userFoto')
  userFoto.src = event.target.src
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
}

/* Funcion para obtener todas las cartas de los mazos del usuario */
function getCartas (mazoActual, idCartaMazo) {
  const cartasNoMazo = document.getElementById('cartas-no-mazo')
  const cartas = document.getElementsByClassName('cartas')[0]
  const idUsuario = localStorage.getItem('id')
  cartasNoMazo.style.display = 'flex'
  cartas.innerHTML = ''
  fetch(`/getCardsDeck?mazo=${mazoActual}&idUsuario=${idUsuario}`, {
    method: 'GET'
  })
    .then(response => response.json())
    .then(data => {
      const length = data.filteredCards.length
      for (let i = 0; i < length; i++) {
        const card = data.filteredCards[i]

        const cardDiv = document.createElement('div')
        cardDiv.className = 'carta'
        cardDiv.style.backgroundImage = `url(${card.foto})`
        cardDiv.setAttribute('onclick', `guardarCarta(${card.id}, ${mazoActual}, ${idCartaMazo})`)

        const nombreCarta = document.createElement('p')
        nombreCarta.className = 'nombreCarta'
        nombreCarta.innerHTML = card.nombre

        if (data.ataques[i][0]) {
          const ataqueEspecial = document.createElement('p')
          ataqueEspecial.className = 'ataque-especial'
          const textoAtaqueEspecial = data.ataques[i][0].nombre + ' - ' + data.ataques[i][0].descripcion
          ataqueEspecial.innerHTML = textoAtaqueEspecial

          cardDiv.appendChild(ataqueEspecial)
        }

        const ataqueVida = document.createElement('p')
        ataqueVida.className = 'ataque-vida'
        ataqueVida.innerHTML = card.ataque + '/' + card.vida

        cardDiv.appendChild(ataqueVida)
        cardDiv.appendChild(nombreCarta)
        cartas.appendChild(cardDiv)
      }
    })
}

function cerrarCartasNoMazo () {
  const cartasNoMazo = document.getElementById('cartas-no-mazo')
  cartasNoMazo.style.display = 'none'
}

/* Funcion para guarda una carta en el mazo */
function guardarCarta (idCarta, mazoActual, idCartaMazo) {
  fetch('/guardarCarta', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ idCarta, mazoActual, idCartaMazo })
  })
    .then(response => response.json())
    .then(data => {
      window.location.reload()
    })
}

/* Cambiar el mazo seleccionado al anterior */
function mazoAtras () {
  const mazo = document.getElementsByClassName('mazo')
  const mazoActual = document.getElementsByClassName('mazoActual')[0]
  if (parseInt(mazoActual.textContent) > 1) {
    const mazoActual = document.getElementsByClassName('mazoActual')[0]
    const nuevoMazo = parseInt(mazoActual.textContent) - 1
    mazoActual.textContent = nuevoMazo
    const deckName = document.getElementById('deckName')
    deckName.textContent = 'Deck ' + nuevoMazo
    fetch('/nuevoMazo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nuevoMazo, id: localStorage.getItem('id') })
    })
    mazo[nuevoMazo - 1].style.display = 'grid'
    mazo[nuevoMazo].style.display = 'none'
  }
}

/* Cambiar el mazo seleccionado al siguiente */
function siguienteMazo () {
  const mazo = document.getElementsByClassName('mazo')
  const mazoActual = document.getElementsByClassName('mazoActual')[0]
  if (parseInt(mazoActual.textContent) < 3) {
    const mazoActual = document.getElementsByClassName('mazoActual')[0]
    const nuevoMazo = parseInt(mazoActual.textContent) + 1
    mazoActual.textContent = nuevoMazo
    const deckName = document.getElementById('deckName')
    deckName.textContent = 'Deck ' + nuevoMazo
    fetch('/nuevoMazo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nuevoMazo, id: localStorage.getItem('id') })
    })
    mazo[nuevoMazo - 1].style.display = 'grid'
    mazo[nuevoMazo - 2].style.display = 'none'
  }
}

function cerrarSobre () {
  const sobresGod = document.getElementById('sobres_god')
  sobresGod.style.display = 'none'
}

function salirMostrarCartas () {
  const data = JSON.parse(localStorage.getItem('cartas'))
  let foundDuplicate = false

  if (data.length === 0) {
    window.location.reload()
  }

  data.forEach((card) => {
    if (card.duplicate) {
      foundDuplicate = true
    }
  })

  if (!foundDuplicate) {
    localStorage.removeItem('cartas')
    window.location.reload()
  } else {
    alert('Hay cartas duplicada')
  }
}

function quickSell (cartaId, oroCarta, cartaClass) {
  const arrayCartas = JSON.parse(localStorage.getItem('cartas'))
  const cartas = arrayCartas.filter((carta) => carta.id !== cartaId)
  const cartaClassArray = JSON.parse(localStorage.getItem('cartaClassArray'))
  const cartaClassArrayFiltered = cartaClassArray.filter((carta) => carta !== cartaClass)

  fetch('/quickSell', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id: localStorage.getItem('id'), oroCarta })
  })
    .then(response => response.json())

  let oroTotal = parseInt(localStorage.getItem('oroTotal')) || 0
  if (oroTotal > 0) {
    oroTotal = oroTotal - oroCarta
    if (oroTotal < 0) {
      oroTotal = 0
    }
  }
  localStorage.setItem('oroTotal', oroTotal)

  const carta = document.getElementsByClassName(cartaClass)[0]
  carta.remove()
  localStorage.setItem('cartas', JSON.stringify(cartas))

  if (cartaClassArrayFiltered.length === 0) {
    localStorage.removeItem('cartaClassArray')
  } else {
    localStorage.setItem('cartaClassArray', JSON.stringify(cartaClassArrayFiltered))
  }

  if (cartas.length === 0) {
    window.location.reload()
  }
}

function quickSellAll () {
  const oroTotal = localStorage.getItem('oroTotal')

  const cartasNoDuplicadas = JSON.parse(localStorage.getItem('cartas')).filter((carta) => !carta.duplicate)

  const cartaClassArray = JSON.parse(localStorage.getItem('cartaClassArray'))

  fetch('/quickSell', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id: localStorage.getItem('id'), oroCarta: oroTotal })
  })
    .then(response => response.json())

  localStorage.setItem('cartas', JSON.stringify(cartasNoDuplicadas))
  cartaClassArray.forEach(cartaClass => {
    const carta = document.getElementsByClassName(cartaClass)[0]
    carta.remove()
  })

  localStorage.removeItem('cartaClassArray')
  localStorage.setItem('oroTotal', 0)

  if (cartasNoDuplicadas.length === 0) {
    window.location.reload()
  }
}

function putOnMarket (idCarta, rareza) {
  const putOnMarket = document.getElementsByClassName('put_on_market')[0]
  putOnMarket.style.display = 'flex'

  const putOnMarketForm = document.getElementsByClassName('put_on_market_form')[0]

  const inputRareza = document.createElement('input')
  inputRareza.type = 'hidden'
  inputRareza.name = 'rareza'
  inputRareza.id = 'rareza'
  inputRareza.value = rareza

  const inputIdCarta = document.createElement('input')
  inputIdCarta.type = 'hidden'
  inputIdCarta.name = 'idCarta'
  inputIdCarta.id = 'idCarta'
  inputIdCarta.value = idCarta

  putOnMarketForm.appendChild(inputRareza)
  putOnMarketForm.appendChild(inputIdCarta)

  const precio = document.getElementById('precio')
  const maxAndMin = document.getElementById('maxAndMin')
  if (rareza === 5) {
    maxAndMin.innerHTML = 'min. 1000 - max. 5000'
    precio.value = 1000
  } else if (rareza === 4) {
    maxAndMin.innerHTML = 'min. 500 - max. 1000'
    precio.value = 500
  } else if (rareza === 3) {
    maxAndMin.innerHTML = 'min. 100 - max. 500'
    precio.value = 100
  } else if (rareza === 2) {
    maxAndMin.innerHTML = 'min. 50 - max. 100'
    precio.value = 50
  } else {
    maxAndMin.innerHTML = 'min. 10 - max. 50'
    precio.value = 10
  }
}

function buyCard (idMercado, idCarta, precio, nombre) {
  fetch('/confirmBuy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ idCarta, precio, id: localStorage.getItem('id') })
  })
    .then(response => response.json())
    .then(data => {
      if (data.message === 'Not enough gold') {
        alert('Not enough gold')
      } else if (data.message === 'Card in possession') {
        alert('You already have this card')
      } else {
        const confirmarDiv = document.getElementsByClassName('confirmar_compra_carta')[0]
        confirmarDiv.style.display = 'flex'
        if (document.getElementsByClassName('comprar_confirmar')[0]) {
          document.getElementsByClassName('comprar_confirmar')[0].remove()
        }

        const buttonConfirmar = document.createElement('button')
        buttonConfirmar.textContent = 'BUY'
        buttonConfirmar.className = 'comprar_confirmar'
        buttonConfirmar.setAttribute('onclick', `confirmarCompra(${idMercado}, ${idCarta}, ${precio})`)

        if (document.getElementsByClassName('cancelar_compra')[0]) {
          document.getElementsByClassName('cancelar_compra')[0].remove()
        }

        const cancelarButton = document.createElement('button')
        cancelarButton.textContent = 'CANCEL'
        cancelarButton.className = 'cancelar_compra'
        cancelarButton.setAttribute('onclick', 'cancelarCompraCarta()')

        confirmarDiv.appendChild(buttonConfirmar)
        confirmarDiv.appendChild(cancelarButton)
        document.getElementsByClassName('nombre_carta_confirmar')[0].textContent = 'Are you sure you want to buy ' + nombre + ' for ' + precio + ' of gold?'
      }
    })
}

function confirmarCompra (idMercado, idCarta, precio) {
  fetch('/buyCard', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ idMercado, idCarta, precio, id: localStorage.getItem('id') })
  })
    .then(response => response.json())
    .then(data => {
      if (data.message === 'Card bought') {
        window.location.reload()
      }
    })
}

/* Funcion para cerrar el cuadro para confirmar la compra de una carta */
function cancelarCompraCarta () {
  const confirmarDiv = document.getElementsByClassName('confirmar_compra_carta')[0]
  confirmarDiv.style.display = 'none'
  const buttonConfirmar = document.getElementsByClassName('comprar_confirmar')[0]
  buttonConfirmar.remove()
}

function comprarChest (precio, cantidad) {
  const confirmacion = document.getElementsByClassName('confirmacion')[0]
  if (confirmacion) {
    confirmacion.remove()
  }
  fetch('/buyChest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ precio, cantidad, id: localStorage.getItem('id') })
  })
    .then(response => response.json())
    .then(data => {
      if (data.message === 'Not enough gold') {
        alert('Not enough gold')
      } else {
        const chest = document.getElementsByClassName('chest')[0]
        const confirmacion = document.createElement('p')
        confirmacion.textContent = 'You have bought ' + cantidad + ' chests for ' + precio + ' of gold'
        confirmacion.style.color = 'green'
        confirmacion.className = 'confirmacion'
        chest.appendChild(confirmacion)
      }
    })
}
