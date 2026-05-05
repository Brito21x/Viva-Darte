// Localização: backend/src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const utilizadorController = require('../controllers/utilizadorController');
const { autenticar } = require('../middlewares/auth');

// Rotas Públicas
router.post('/register', utilizadorController.registar);
router.post('/login', utilizadorController.login);
router.post('/reset-password', utilizadorController.resetPassword);
router.post('/verificar-telefone', utilizadorController.verificarTelefone);

// Rotas Protegidas (precisam de token)
router.get('/me', autenticar, utilizadorController.me);

module.exports = router;