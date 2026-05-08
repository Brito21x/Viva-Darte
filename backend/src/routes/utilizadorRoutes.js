const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { autenticar, autorizar } = require('../middlewares/auth');

router.use(autenticar);

// GET /api/utilizadores/me/alunos — alunos do EE autenticado (antes de /:id)
router.get('/me/alunos', authController.getMeusAlunos);

// GET /api/utilizadores — lista (Admin)
router.get('/', autorizar('Admin'), authController.listarUtilizadores);

// POST /api/utilizadores — criar conta (Admin)
router.post('/', autorizar('Admin'), authController.criarUtilizadorAdmin);

// PUT /api/utilizadores/:id — editar (Admin)
router.put('/:id', autorizar('Admin'), authController.editarUtilizador);

// PATCH /api/utilizadores/:id/estado — ativar/desativar (Admin)
router.patch('/:id/estado', autorizar('Admin'), authController.alterarEstado);

module.exports = router;
