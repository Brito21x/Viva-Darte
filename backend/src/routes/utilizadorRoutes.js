const express = require('express');
const router = express.Router();

const utilizadorController = require('../controllers/utilizadorController');
const { autenticar, autorizar } = require('../middlewares/auth');

// Todas as rotas requerem autenticação
router.use(autenticar);

// GET /api/utilizadores — listar todos (Admin)
router.get('/', autorizar('Admin'), utilizadorController.listarUtilizadores);

// POST /api/utilizadores — criar utilizador (Admin)
router.post('/', autorizar('Admin'), utilizadorController.criarUtilizador);

// PUT /api/utilizadores/:id — editar utilizador (Admin)
router.put('/:id', autorizar('Admin'), utilizadorController.editarUtilizador);

// PATCH /api/utilizadores/:id/estado — ativar/desativar (Admin)
router.patch('/:id/estado', autorizar('Admin'), utilizadorController.alterarEstadoUtilizador);

// GET /api/utilizadores/meus-alunos — alunos do EE autenticado
router.get('/meus-alunos', autorizar('EE'), utilizadorController.getAlunosPorEncarregado);

// GET /api/utilizadores/:id/alunos — alunos de um EE específico (Admin/Coordenação)
router.get('/:id/alunos', autorizar('Admin'), utilizadorController.getAlunosPorEncarregadoId);

module.exports = router;