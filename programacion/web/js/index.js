/* eslint-disable no-unused-vars */
function showRegister () {
  const loginContainer = document.getElementById('divLogin')
  const registerContainer = document.getElementById('register')

  // Oculta el contenedor de inicio de sesión
  loginContainer.style.display = 'none'

  // Muestra el contenedor de registro
  registerContainer.style.display = 'block'
}
const fullscreenIcon = document.getElementById('fullscreenIcon')

function showforgot () {
  const loginContainer = document.getElementById('login')
  const forgotContainer = document.getElementById('forgot')

  // Oculta el contenedor de inicio de sesión
  loginContainer.style.display = 'none'

  // Muestra el contenedor de registro
  forgotContainer.style.display = 'block'
}

// Función para alternar entre pantalla completa y salida de pantalla completa
function toggleFullscreen () {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
    fullscreenIcon.classList.add('fullscreen')
    fullscreenIcon.classList.remove('exitedFullscreen')
  } else {
    document.exitFullscreen()
    fullscreenIcon.classList.remove('fullscreen')
    fullscreenIcon.classList.add('exitedFullscreen')
  }
}

// Asocia la función al evento de clic en el icono
fullscreenIcon.addEventListener('click', toggleFullscreen)

// Escucha el evento de cambio en la pantalla completa para actualizar el icono
document.addEventListener('fullscreenchange', function () {
  if (document.fullscreenElement) {
    fullscreenIcon.classList.add('fullscreen')
    fullscreenIcon.classList.remove('exitedFullscreen')
  } else {
    fullscreenIcon.classList.remove('fullscreen')
    fullscreenIcon.classList.add('exitedFullscreen')
  }
})

// introduccion
function mostrarHowtoplay () {
  const introContainer = document.getElementById('intro')
  const howtoplayContainer = document.getElementById('howtoplay')

  // Oculta el contenedor de inicio de sesión
  introContainer.style.display = 'none'

  // Muestra el contenedor de registro
  howtoplayContainer.style.display = 'block'
}
