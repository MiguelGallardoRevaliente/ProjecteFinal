/* eslint-disable no-unused-vars */
function showRegister () {
  const loginContainer = document.getElementById('divLogin')
  const registerContainer = document.getElementById('register')

  // Oculta el contenedor de inicio de sesión
  loginContainer.style.display = 'none'

  // Muestra el contenedor de registro
  registerContainer.style.display = 'block'
}

function showforgot () {
  const loginContainer = document.getElementById('divLogin')
  const forgotContainer = document.getElementById('forgot')

  // Oculta el contenedor de inicio de sesión
  loginContainer.style.display = 'none'

  // Muestra el contenedor de registro
  forgotContainer.style.display = 'block'
}

// introduccion
function mostrarHowtoplay () {
  const introContainer = document.getElementById('intro')
  const howtoplayContainer = document.getElementById('howtoplay')

  // Oculta el contenedor de inicio de sesión
  introContainer.style.display = 'none'

  // Muestra el contenedor de registro
  howtoplayContainer.style.display = 'block'
}

function atrasHowToPlay (){
  const introContainer = document.getElementById('intro')
  const howtoplayContainer = document.getElementById('howtoplay')

  // Oculta el contenedor de inicio de sesión
  introContainer.style.display = 'block'

  // Muestra el contenedor de registro
  howtoplayContainer.style.display = 'none'
}
