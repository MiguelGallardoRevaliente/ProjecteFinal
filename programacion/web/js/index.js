function showRegister() {
    var loginContainer = document.getElementById('login');
    var registerContainer = document.getElementById('register');

    // Oculta el contenedor de inicio de sesión
    loginContainer.style.display = 'none';

    // Muestra el contenedor de registro
    registerContainer.style.display = 'block';
}

        var fullscreenIcon = document.getElementById('fullscreenIcon');

        // Función para alternar entre pantalla completa y salida de pantalla completa
        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
                fullscreenIcon.classList.add('fullscreen');
                fullscreenIcon.classList.remove('exitedFullscreen');
            } else {
                document.exitFullscreen();
                fullscreenIcon.classList.remove('fullscreen');
                fullscreenIcon.classList.add('exitedFullscreen');
            }
        }

        // Asocia la función al evento de clic en el icono
        fullscreenIcon.addEventListener('click', toggleFullscreen);

        // Escucha el evento de cambio en la pantalla completa para actualizar el icono
        document.addEventListener('fullscreenchange', function () {
            if (document.fullscreenElement) {
                fullscreenIcon.classList.add('fullscreen');
                fullscreenIcon.classList.remove('exitedFullscreen');
            } else {
                fullscreenIcon.classList.remove('fullscreen');
                fullscreenIcon.classList.add('exitedFullscreen');
            }
        });