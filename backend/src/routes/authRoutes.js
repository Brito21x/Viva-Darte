const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { autenticar } = require('../middlewares/auth');

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/logout  (requer token válido)
router.post('/logout', autenticar, authController.logout);

// POST /api/auth/recuperar-password
router.post('/recuperar-password', authController.solicitarRecuperacaoPassword);

// POST /api/auth/redefinir-password
router.post('/redefinir-password', authController.redefinirPassword);

// POST /api/auth/register
router.post('/register', authController.register);

// GET /api/auth/utilizadores (Traz todos os utilizadores para a tabela de Admin)
router.get('/utilizadores', autenticar, authController.listarUtilizadores);

// PUT /api/auth/utilizadores/:id/ativar (Aceitar utilizador pendente)
router.put('/utilizadores/:id/ativar', autenticar, authController.ativarUtilizador);

module.exports = router;