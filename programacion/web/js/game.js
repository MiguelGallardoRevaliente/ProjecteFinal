//DEJAR DE MOSTRAR UN DIV #HOME
const home = document.getElementById('home')
const information = document.getElementById('information')
const inventory = document.getElementById('inventory')
const shop = document.getElementById('shop')
const settings = document.getElementById('settings')

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
  settings.style.display = 'none'
}

function mostrarShop () {
  home.style.display = 'none'
  information.style.display = 'none'
  inventory.style.display = 'none'
  shop.style.display = 'block'
  settings.style.display = 'none'
}

function mostrarHome () {
  information.style.display = 'none'
  inventory.style.display = 'none'
  shop.style.display = 'none'
  home.style.display = 'block'
  settings.style.display = 'none'
}

function mostrarSettings () {
  home.style.display = 'none'
  information.style.display = 'none'
  inventory.style.display = 'none'
  shop.style.display = 'none'
  settings.style.display = 'block'
}


//FUNCION PARA CAMBIAR DE PAGINA EN "SHOP"
const shopcards = document.getElementById('shop_cards')
const shopchests = document.getElementById('shop_chests')
const allcards = document.getElementById('allcards')

function mostrarShopCards () {
  allcards.style.display = 'block'
  allchests.style.display = 'none'
  shopchests.style.boxShadow = '1px 1px 5px black inset';
  shopcards.style.boxShadow = '1px 1px 5px black';
  shopcards.style.backgroundColor = 'gray';
  shopchests.style.backgroundColor = '#292929';
  
}

function mostrarShopChests () {
  allcards.style.display = 'none'
  allchests.style.display = 'block'
  shopcards.style.boxShadow = '1px 1px 5px black inset';
  shopchests.style.boxShadow = '1px 1px 5px black';
  shopchests.style.backgroundColor = 'gray';
  shopcards.style.backgroundColor = '#292929';

}