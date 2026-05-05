const express = require('express');
const router = express.Router();

const inventarioController = require('../controllers/inventarioController');
const { autenticar, autorizar } = require('../middlewares/auth');

router.use(autenticar);

// ── CATÁLOGO ──────────────────────────────────────────────────────────────────
router.get('/', inventarioController.getCatalogo);
router.get('/vendas', inventarioController.getPecasAVenda);
router.get('/:id', inventarioController.getPecaDetalhes);
router.post('/', inventarioController.registarPeca);
router.put('/:id', inventarioController.atualizarEstadoPeca);

// ── EMPRÉSTIMOS ───────────────────────────────────────────────────────────────
router.post('/emprestimos', inventarioController.requisitarEmprestimo);
router.put('/emprestimos/:id/devolucao', inventarioController.registarDevolucao);
router.post('/emprestimos/:id/penalizacoes', autorizar('Admin'), inventarioController.registarPenalizacao);
router.put('/emprestimos/:id/pagamento', autorizar('Admin'), inventarioController.registarPagamentoEmprestimo);

// ── VENDAS ────────────────────────────────────────────────────────────────────
router.post('/vendas', inventarioController.colocarPecaAVenda);

// CORREÇÃO: Removido o autorizar('Admin') para qualquer um poder comprar
router.put('/vendas/:id/concluir', inventarioController.registarConclusaoVenda);

router.put('/:id/editar', inventarioController.editarPeca);
router.delete('/:id', inventarioController.apagarPeca);

module.exports = router;