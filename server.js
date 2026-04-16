require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Middlewares para Backend
app.use(express.json());
app.use(express.static('public'));

// --- CONEXIÓN A BASE DE DATOS MySQL (XAMPP / Railway) ---
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'mysql.railway.internal',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'railway',
    port: process.env.MYSQL_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// --- PROXY ENDPOINTS (Ocultando llaves del cliente) ---

// [GET] Proxy Clima (OpenWeatherMap)
app.get('/api/clima', async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: "lat y lon son requeridos" });
    try {
        const apiKey = process.env.OPENWEATHER_API_KEY;
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=es`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Error OpenWeather Proxy:", error);
        res.status(500).json({ error: "Error obteniendo clima" });
    }
});

// [GET] Proxy Lugares (OpenStreetMap Nominatim)
app.get('/api/lugares', async (req, res) => {
    const { lat, lon } = req.query;
    try {
        const latT = parseFloat(lat);
        const lonT = parseFloat(lon);
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=electronics+OR+video&limit=8&bounded=1&viewbox=${lonT - 0.1},${latT + 0.1},${lonT + 0.1},${latT - 0.1}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Error Nominatim Proxy:", error);
        res.status(500).json({ error: "Error obteniendo lugares" });
    }
});

// [GET] Obtener Configuración PayPal (Client ID público)
app.get('/api/config/paypal', (req, res) => {
    res.json({ clientId: process.env.PAYPAL_CLIENT_ID });
});

// --- PAYPAL S2S (Server-to-Server) ---

// Función auxiliar para obtener Access Token de PayPal
async function generatePayPalAccessToken() {
    const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64');
    const response = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
        method: "POST",
        body: "grant_type=client_credentials",
        headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }
    });
    const data = await response.json();
    return data.access_token;
}

// [POST] Crear Orden de Pago PayPal
app.post('/api/pagos/crear-orden', async (req, res) => {
    try {
        const { total } = req.body;
        const accessToken = await generatePayPalAccessToken();
        const response = await fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                intent: "CAPTURE",
                purchase_units: [{ amount: { currency_code: "USD", value: parseFloat(total).toFixed(2) } }]
            })
        });
        const order = await response.json();
        res.json({ id: order.id });
    } catch (error) {
        console.error("Error creando orden PayPal:", error);
        res.status(500).json({ error: "Error creando orden en PayPal" });
    }
});

// [POST] Capturar Orden y Guardar en MySQL
app.post('/api/pagos/capturar-orden', async (req, res) => {
    try {
        const { orderID, cliente, productos, total } = req.body;
        const accessToken = await generatePayPalAccessToken();
        const response = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderID}/capture`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            }
        });
        const captureData = await response.json();

        if (captureData.status === "COMPLETED") {
            const id_orden_local = 'ORD-' + Math.floor(Math.random() * 100000);
            await pool.query(
                "INSERT INTO ordenes (id_orden, cliente, productos, total) VALUES (?, ?, ?, ?)",
                [id_orden_local, cliente || 'Desconocido', productos, total]
            );
            console.log("\n[Base de Datos] 🟢 Nueva orden guardada exitosamente en MySQL:", id_orden_local);
            res.status(201).json({ success: true, ordenId: id_orden_local, capture: captureData });
        } else {
            res.status(400).json({ success: false, error: "Pago no capturado por PayPal." });
        }
    } catch (error) {
        console.error("Error capturando pago:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
});

// [GET] Obtener Tiendas desde la BD
app.get('/api/tiendas', async (req, res) => {
    try {
        console.log("[Base de Datos] 🟢 Obteniendo tiendas desde MySQL...");
        const [rows] = await pool.query("SELECT * FROM tiendas");
        res.json(rows);
    } catch (err) {
        console.error("❌ Error conectando a MySQL:", err);
        // Fallback a algunas por defecto si no hay conexión
        res.status(500).json([{ id: 0, lat_offset: 0, lon_offset: 0, nombre: "Error BD XAMPP (Local)" }]);
    }
});

// [POST] Registro de Usuario
app.post('/api/registro', async (req, res) => {
    const { nombre, correo, password } = req.body;
    try {
        const [existing] = await pool.query("SELECT * FROM usuarios WHERE correo = ?", [correo]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, error: "El correo ya está registrado." });
        }
        await pool.query("INSERT INTO usuarios (nombre, correo, password) VALUES (?, ?, ?)", [nombre || 'Usuario', correo, password]);
        res.json({ success: true, message: "Usuario creado exitosamente" });
    } catch (err) {
        console.error("❌ Error en registro MySQL:", err);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
});

// [POST] Inicio de Sesión
app.post('/api/login', async (req, res) => {
    const { correo, password } = req.body;
    try {
        const [users] = await pool.query("SELECT * FROM usuarios WHERE correo = ? AND password = ?", [correo, password]);
        if (users.length > 0) {
            res.json({ success: true, user: { nombre: users[0].nombre, correo: users[0].correo } });
        } else {
            res.status(401).json({ success: false, error: "Credenciales incorrectas." });
        }
    } catch (err) {
        console.error("❌ Error en login MySQL:", err);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
});

// Ruta default de Frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar Servidor Backend
app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`Servidor Backend Node.js+Express activo!`);
    console.log(`Modo Base de Datos: Activo (Mock MySQL/Firebase)`);
    console.log(`Escuchando en http://localhost:${PORT}`);
    console.log(`========================================`);
});