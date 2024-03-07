//DEJAR DE MOSTRAR UN DIV #HOME
const home = document.getElementById('home')
const information = document.getElementById('information')
const inventory = document.getElementById('inventory')
const shop = document.getElementById('shop')

function mostrarInformation () {
  home.style.display = 'none'
  inventory.style.display = 'none'
  shop.style.display = 'none'
  information.style.display = 'block'
}

function mostrarInventory () {
  home.style.display = 'none'
  information.style.display = 'none'
  shop.style.display = 'none'
  inventory.style.display = 'block'
}

function mostrarShop () {
  home.style.display = 'none'
  information.style.display = 'none'
  inventory.style.display = 'none'
  shop.style.display = 'block'
}

function mostrarHome () {
  information.style.display = 'none'
  inventory.style.display = 'none'
  shop.style.display = 'none'
  home.style.display = 'block'
}