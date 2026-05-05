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

module.exports = router;