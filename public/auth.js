import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

let isLogin = true;

window.toggleAuth = function() {
    isLogin = !isLogin;
    const nameField = document.getElementById('name-field');
    const authTitle = document.getElementById('auth-title');
    const btnText = document.getElementById('btn-text');
    const toggleText = document.getElementById('toggle-auth');

    if (isLogin) {
        authTitle.innerText = 'Iniciar Sesión';
        btnText.innerText = 'Entrar';
        nameField.style.display = 'none';
        toggleText.innerHTML = '¿No tienes cuenta? <span onclick="toggleAuth()">Regístrate aquí</span>';
    } else {
        authTitle.innerText = 'Crear Cuenta';
        btnText.innerText = 'Registrarse';
        nameField.style.display = 'block';
        toggleText.innerHTML = '¿Ya tienes cuenta? <span onclick="toggleAuth()">Inicia sesión</span>';
    }
};

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btnText = document.getElementById('btn-text');
    
    // Si estuviéramos registrando el "Nombre", aquí lo leeríamos, 
    // pero por ahora Authentication maneja correos de forma directa.
    
    const originalText = btnText.innerText;
    btnText.innerText = 'Cargando...';
    
    try {
        if (isLogin) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            await createUserWithEmailAndPassword(auth, email, password);
        }
        // Redirigir a inicio si todo sale bien
        window.location.href = 'index.html'; 
    } catch (error) {
        let msg = error.message;
        if(error.code === 'auth/invalid-email') msg = "El correo no es válido.";
        if(error.code === 'auth/email-already-in-use') msg = "Este correo ya está registrado.";
        if(error.code === 'auth/weak-password') msg = "La contraseña debe tener al menos 6 caracteres.";
        if(error.code === 'auth/invalid-credential') msg = "Contraseña o usuario incorrecto.";
        
        alert("Error al entrar: " + msg);
        btnText.innerText = originalText;
    }
});
