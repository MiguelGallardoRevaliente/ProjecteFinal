function showRegister() {
    var loginContainer = document.getElementById('login');
    var registerContainer = document.getElementById('register');

    // Oculta el contenedor de inicio de sesión
    loginContainer.style.display = 'none';

    // Muestra el contenedor de registro
    registerContainer.style.display = 'block';
}