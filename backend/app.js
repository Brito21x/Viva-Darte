const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { poolConnect } = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const utilizadorRoutes = require('./src/routes/utilizadorRoutes');
const escolaRoutes = require('./src/routes/escolaRoutes');
const coachingRoutes = require('./src/routes/coachingRoutes');
const inventarioRoutes = require('./src/routes/inventarioRoutes');
const faturacaoRoutes = require('./src/routes/faturacaoRoutes');
const errorHandler = require('./src/middlewares/errorHandler');

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

app.get('/api/health', (req, res) => {
    res.json({ status: 'online', message: "Servidor Viva D'arte a bombar!" });
});

app.use('/api/auth', authRoutes);
app.use('/api/utilizadores', utilizadorRoutes);
app.use('/api/escola', escolaRoutes);
app.use('/api/coaching', coachingRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/faturacao', faturacaoRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

poolConnect
    .then(() => {
        app.listen(PORT, () => {
            console.log(`✅ Servidor a bombar em: http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('❌ Erro crítico ao ligar à BD:', error.message);
        process.exit(1);
    });
