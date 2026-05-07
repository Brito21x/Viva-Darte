const express = require('express');
const router = express.Router();

const utilizadorController = require('../controllers/utilizadorController');
const { autenticar, autorizar } = require('../middlewares/auth');

router.use(autenticar);

// GET /api/utilizadores/me/alunos — alunos do EE autenticado (antes de /:id)
router.get('/me/alunos', utilizadorController.getMeusAlunos);

// GET /api/utilizadores — lista (Admin)
router.get('/', autorizar('Admin'), utilizadorController.listarUtilizadores);

// POST /api/utilizadores — criar conta (Admin)
router.post('/', autorizar('Admin'), utilizadorController.criarUtilizadorAdmin);

// PUT /api/utilizadores/:id — editar (Admin)
router.put('/:id', autorizar('Admin'), utilizadorController.editarUtilizador);

// PATCH /api/utilizadores/:id/estado — ativar/desativar (Admin)
router.patch('/:id/estado', autorizar('Admin'), utilizadorController.alterarEstado);

module.exports = router;
