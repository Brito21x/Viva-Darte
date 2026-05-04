const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { poolConnect } = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const errorHandler = require('./src/middlewares/errorHandler');

const app = express();

// Middleware
app.use(express.json());

// CORS flexível para ambiente local (qualquer porta em localhost/127.0.0.1)
app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        const permitido = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
        if (permitido) return callback(null, true);
        return callback(new Error('Origem não permitida pelo CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rota de teste
app.get('/api/health', (req, res) => {
    res.json({ status: "online", message: "Servidor Viva D'arte a bombar!" });
});

// Definição de Rotas
app.use('/api/auth', authRoutes);

// Tratamento de Erros (sempre no fim)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Ligar à Base de Dados e iniciar Servidor
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