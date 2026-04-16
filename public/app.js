

// --- 1. CLIMA (Proxy local) ---

function obtenerClima(lat, lon) {
    fetch(`/api/clima?lat=${lat}&lon=${lon}`)
        .then(response => response.json())
        .then(data => {
            const temp = Math.round(data.main.temp);
            const desc = data.weather[0].description;
            const doc = document.getElementById('datos-clima');
            // Interfaz de Clima en OpenWeather
            doc.innerHTML = `<span style="font-size: 1.8rem; font-weight: 800;">${temp}°C</span> <br> 
                             <span style="font-size:1.1rem; color:var(--text-muted);"><i class="fa-solid fa-location-dot"></i> ${data.name} - ${desc}</span>`;
            document.getElementById('clima-widget').classList.remove('hidden');
        })
        .catch(err => console.log('Error clima:', err));
}

// Inicialización basica (Geolocalización)
navigator.geolocation.getCurrentPosition(
    position => {
        const { latitude, longitude } = position.coords;
        obtenerClima(latitude, longitude);
        iniciarMapa(latitude, longitude);
    },
    error => {
        // Fallback a coordenadas por defecto (ej. Ciudad de México)
        iniciarMapa(19.4326, -99.1332);
    }
);

// --- 2. MAPA DE TIENDAS Y API PLACES (Leaflet) ---
let mapa;
function iniciarMapa(lat, lon) {
    if (mapa) return;
    mapa = L.map('mapa-tiendas').setView([lat, lon], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap API'
    }).addTo(mapa);

    // Marcador Principal "TÚ"
    L.marker([lat, lon]).addTo(mapa).bindPopup('<b style="color:red;">📍 Estás aquí</b>').openPopup();

    // 2.A: TIENDAS OFICIALES DESDE MYSQL (Consumiendo la API local)
    fetch('/api/tiendas')
        .then(res => res.json())
        .then(tiendasDB => {
            tiendasDB.forEach(t => {
                L.marker([lat + parseFloat(t.lat_offset), lon + parseFloat(t.lon_offset)]).addTo(mapa)
                    .bindPopup(`<strong style="color:var(--primary);">${t.nombre}</strong><br>Tienda Oficial (Conectada a Base de Datos)`);
            });
        }).catch(err => {
            console.error("Error cargando tiendas de DB", err);
            L.marker([lat, lon]).addTo(mapa)
                .bindPopup(`<strong style="color:red;">Error de Base de datos</strong>`);
        });

    // 2.B: GENERACIÓN MASIVA ("muchas más tiendas" - Script Dinámico ConsoleWorld)
    const storeNombres = ["CW Store Centro", "Gamer Station CW", "ConsoleWorld Express", "CW Elite", "PlayArea CW", "Retro ConsoleWorld"];
    for (let i = 0; i < 25; i++) {
        // Distribuirlas aleatoriamente en un radio cercano de ~6Km
        const rLat = lat + (Math.random() - 0.5) * 0.09;
        const rLon = lon + (Math.random() - 0.5) * 0.09;
        const randomName = storeNombres[Math.floor(Math.random() * storeNombres.length)];

        L.marker([rLat, rLon]).addTo(mapa)
            .bindPopup(`<strong style="color:var(--bg-dark);">${randomName} #${i + 100}</strong><br>Stock asegurado hoy.`);
    }

    // 2.C: API PLACES (Via Proxy Backend local)
    fetch(`/api/lugares?lat=${lat}&lon=${lon}`)
        .then(res => res.json())
        .then(places => {
            places.forEach(place => {
                L.circleMarker([place.lat, place.lon], { color: 'black', radius: 5 }).addTo(mapa)
                    .bindPopup(`<strong style="color:var(--bg-dark);">${place.display_name.split(',')[0]}</strong><br>Places API Locator`);
            });
        }).catch(e => console.log('Places API error:', e));
}

// --- 3. PASARELA Y ACCIONES DE CARRITO ---
let carrito = [];

// Manejo de Sesión Local
const currentUserStr = localStorage.getItem('currentUser');
let currentUser = null;

if (currentUserStr) {
    try {
        currentUser = JSON.parse(currentUserStr);
    } catch(e) {}
}

document.addEventListener('DOMContentLoaded', () => {
    // Cargar config de PayPal dinámicamente y ocultado del cliente principal
    fetch('/api/config/paypal').then(res => res.json()).then(data => {
        if (data.clientId) {
            const script = document.createElement('script');
            script.src = `https://www.paypal.com/sdk/js?client-id=${data.clientId}&currency=USD`;
            document.head.appendChild(script);
        }
    });

    const cuentaBtn = document.querySelector('.btn-auth');
    if (currentUser && cuentaBtn) {
        const firstWord = currentUser.nombre ? currentUser.nombre.split(' ')[0] : 'Usuario';
        cuentaBtn.innerHTML = `<i class="fa-solid fa-user-check"></i> ${firstWord} | <a href="#" onclick="cerrarSesionLocal()" style="color:var(--accent);">Salir</a>`;
        cuentaBtn.href = "#";
        cuentaBtn.onclick = (e) => {
            if(e.target.tagName !== 'A') e.preventDefault();
        };
    }
});

window.cerrarSesionLocal = function() {
    localStorage.removeItem('currentUser');
    window.location.reload();
};

function simularPago(producto) {
    if (!currentUser) {
        alert("¡Alto! Debes iniciar sesión o registrarte para realizar tus compras de forma segura.");
        window.location.href = "auth.html";
        return;
    }

    let precioText = "0.00";
    let imgPath = "";

    // Buscar la tarjeta del producto
    const cards = document.querySelectorAll('.product-card');
    cards.forEach(card => {
        const title = card.querySelector('h3');
        if (title && title.innerText === producto) {
            const precioEl = card.querySelector('.precio');
            if (precioEl) precioText = precioEl.innerText.replace('$', '').replace(',', '');
            const imgEl = card.querySelector('img');
            if (imgEl) imgPath = imgEl.src;
        }
    });

    const currentPrice = parseFloat(precioText) || 99.99;

    document.getElementById('pago-producto-nombre').innerText = producto;
    document.getElementById('pago-producto-precio').innerText = `Precio: $${currentPrice}`;
    document.getElementById('modal-pago').classList.remove('hidden');

    // Convertimos la pasarela inicial en un Action Sheet
    const container = document.getElementById('paypal-button-container');
    container.innerHTML = `
        <div style="display: flex; gap: 15px; margin-top: 20px;">
            <button class="btn-main" style="flex: 1;" onclick="agregarDesdeActionSheet('${producto}', '${imgPath}', ${currentPrice})"><i class="fa-solid fa-cart-plus"></i> Al Carrito</button>
            <button class="btn-main" style="flex: 1; background: var(--secondary); box-shadow: var(--glow-secondary);" onclick="abrirPasarela('${producto}', ${currentPrice})"><i class="fa-solid fa-bolt"></i> Comprar</button>
        </div>
    `;
}

function agregarDesdeActionSheet(producto, imagen, precio) {
    const itemExistente = carrito.find(item => item.nombre === producto);
    if (itemExistente) {
        itemExistente.cantidad += 1;
    } else {
        carrito.push({ nombre: producto, precio, cantidad: 1, imagen });
    }
    actualizarCarritoUI();
    cerrarModalPago();
    toggleCarrito(); // Abre el carrito para validación visual
}

function abrirPasarela(nombre, precio) {
    document.getElementById('pago-producto-nombre').innerText = "Cargando: " + nombre;
    document.getElementById('pago-producto-precio').innerText = `Total a pagar: $${precio.toFixed(2)}`;
    document.getElementById('paypal-button-container').innerHTML = ''; // Limpiar
    document.getElementById('modal-pago').classList.remove('hidden');

    if (window.paypal) {
        paypal.Buttons({
            createOrder: (data, actions) => {
                return fetch('/api/pagos/crear-orden', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ total: precio })
                }).then(res => res.json()).then(order => order.id);
            },
            onApprove: (data, actions) => {
                return fetch('/api/pagos/capturar-orden', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderID: data.orderID,
                        cliente: currentUser ? currentUser.nombre : 'Desconocido',
                        productos: nombre,
                        total: precio
                    })
                })
                .then(res => res.json())
                .then(result => {
                    if (result.success) {
                        alert(`¡Pago completado!\nReferencia: ${result.ordenId}\n¡Gracias por tu compra!`);
                        if (nombre.includes("Carrito Central")) carrito = [];
                        actualizarCarritoUI();
                        cerrarModalPago();
                    } else {
                        alert("Error del servidor: " + result.error);
                    }
                }).catch(e => {
                    alert('Pago exitoso en PayPal pero hubo un error validando en tu base de datos.');
                    console.log(e);
                });
            }
        }).render('#paypal-button-container');
    } else {
        document.getElementById('paypal-button-container').innerHTML = '<p style="color:red">Error cargando PayPal SDK. Por favor actualiza la página y verifica tu conexión.</p>';
    }
}

function cerrarModalPago() {
    document.getElementById('modal-pago').classList.add('hidden');
}

// --- 4. ADMINISTRACIÓN DEL CARRITO ---
function toggleCarrito(e) {
    if (e) e.preventDefault();
    document.getElementById('modal-carrito').classList.toggle('hidden');
}

function actualizarCarritoUI() {
    const list = document.getElementById('carrito-items');
    const countBadge = document.getElementById('cart-count');
    const totalEl = document.getElementById('carrito-total');

    // Actualizar Badges
    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    countBadge.innerText = totalItems;
    if (totalItems > 0) countBadge.style.color = "var(--primary)";
    else countBadge.style.color = "";

    if (carrito.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); text-align: center;">El carrito está vacío.</p>';
        totalEl.innerText = '$0.00';
        return;
    }

    let html = '';
    let total = 0;
    carrito.forEach((item, index) => {
        const itemTotal = item.precio * item.cantidad;
        total += itemTotal;
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px;">
                <div style="display: flex; gap: 15px; align-items: center;">
                    <img src="${item.imagen}" style="width: 50px; height: 50px; object-fit: contain; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="text-align: left;">
                        <div style="font-size: 1rem; font-weight: bold; color: white;">${item.nombre}</div>
                        <div style="font-size: 0.9rem; color: var(--primary);">$${item.precio.toFixed(2)} x ${item.cantidad}</div>
                    </div>
                </div>
                <button onclick="eliminarDelCarrito(${index})" style="background: none; border: none; color: var(--accent); cursor: pointer; font-size: 1.2rem; margin-right: 10px;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });

    list.innerHTML = html;
    totalEl.innerText = '$' + total.toFixed(2);
}

function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarCarritoUI();
}

function pagarCarrito() {
    if (carrito.length === 0) return alert('El carrito está vacío.');
    if (!currentUser) {
        alert("¡Espera! Registra una cuenta o inicia sesión antes de procesar el pago seguro.");
        window.location.href = "auth.html";
        return;
    }
    const totalCart = carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
    // Mostrar Modal principal con el Total
    document.getElementById('modal-carrito').classList.add('hidden');
    abrirPasarela('Carrito Central (Todos tus productos)', totalCart);
}

// Exponer funciones al scope global para que los atributos 'onclick' funcionen
window.toggleCarrito = toggleCarrito;
window.simularPago = simularPago;
window.cerrarModalPago = cerrarModalPago;
window.agregarDesdeActionSheet = agregarDesdeActionSheet;
window.abrirPasarela = abrirPasarela;
window.eliminarDelCarrito = eliminarDelCarrito;
window.pagarCarrito = pagarCarrito;

// Removido listener de session