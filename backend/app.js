const express = require('express');
const cors = require('cors');
const errorHandler = require('./src/middlewares/errorHandler');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { pool, poolConnect } = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const escolaRoutes = require('./src/routes/escolaRoutes');
const coachingRoutes = require('./src/routes/coachingRoutes');
const inventarioRoutes = require('./src/routes/inventarioRoutes');

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(
    cors({
        origin(origin, callback) {
            if (!origin) return callback(null, true);
            const permitido = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
            if (permitido) return callback(null, true);
            return callback(new Error('Origem não permitida pelo CORS'));
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    })
);

app.get('/api/health', async (req, res) => {
    try {
        await pool.request().query('SELECT 1 AS ok');
        res.json({
            status: 'online',
            database: 'ligada',
            message: "Servidor Viva D'arte a bombar!"
        });
    } catch (err) {
        res.status(503).json({
            status: 'online',
            database: 'erro',
            message: "Servidor a correr mas a ligação à BD falhou.",
            detail: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

app.use('/api/auth', authRoutes);
app.use('/api/escola', escolaRoutes);
app.use('/api/coaching', coachingRoutes);
app.use('/api/inventario', inventarioRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const MAX_LISTEN_RETRIES = 10;
const RETRY_DELAY_MS = 400;

function startHttpServer(attempt = 1) {
    const server = app.listen(PORT, () => {
        console.log(`✅ Servidor a bombar em: http://localhost:${PORT}`);
    });

    server.on('error', (error) => {
        if (error?.code === 'EADDRINUSE' && attempt < MAX_LISTEN_RETRIES) {
            const nextAttempt = attempt + 1;
            console.warn(
                `⚠️ Porta ${PORT} ocupada no arranque (tentativa ${attempt}/${MAX_LISTEN_RETRIES}). A tentar novamente...`
            );
            setTimeout(() => startHttpServer(nextAttempt), RETRY_DELAY_MS);
            return;
        }

        console.error(`❌ Falha ao iniciar servidor HTTP na porta ${PORT}:`, error.message);
        process.exit(1);
    });
}

poolConnect
    .then(() => {
        startHttpServer();
    })
    .catch((error) => {
        console.error('❌ Erro crítico ao ligar à BD:', error.message);
        process.exit(1);
    });

module.exports = app;
