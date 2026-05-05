const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { autenticar } = require('../middlewares/auth');

router.post('/login', authController.login);
router.post('/logout', autenticar, authController.logout);
router.post('/recuperar-password', authController.solicitarRecuperacaoPassword);
router.post('/redefinir-password', authController.redefinirPassword);
router.post('/register', authController.register);

// Rotas de Gestão do Painel Admin
router.get('/utilizadores', autenticar, authController.listarUtilizadores);
router.put('/utilizadores/:id/ativar', autenticar, authController.ativarUtilizador);
router.put('/utilizadores/:id/desativar', autenticar, authController.desativarUtilizador);

// NOVAS ROTAS (Criar e Editar)
router.post('/utilizadores', autenticar, authController.adminCriarUtilizador);
router.put('/utilizadores/:id', autenticar, authController.editarUtilizadorCompleto);

module.exports = router;