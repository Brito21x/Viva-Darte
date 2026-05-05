const express = require('express');
const router = express.Router();

const inventarioController = require('../controllers/inventarioController');
const { autenticar, autorizar } = require('../middlewares/auth');

router.use(autenticar);

// ── CATÁLOGO ──────────────────────────────────────────────────────────────────
// GET  /api/inventario
router.get('/', inventarioController.getCatalogo);

// GET  /api/inventario/vendas — peças à venda (antes de /:id para não colidir)
router.get('/vendas', inventarioController.getPecasAVenda);

// GET  /api/inventario/:id — detalhe de peça
router.get('/:id', inventarioController.getPecaDetalhes);

// POST /api/inventario — registar peça
router.post('/', inventarioController.registarPeca);

// PUT  /api/inventario/:id — atualizar estado/disponibilidade
router.put('/:id', inventarioController.atualizarEstadoPeca);

// ── EMPRÉSTIMOS ───────────────────────────────────────────────────────────────
// POST /api/inventario/emprestimos — requisitar empréstimo
router.post('/emprestimos', inventarioController.requisitarEmprestimo);

// PUT  /api/inventario/emprestimos/:id/devolucao — registar devolução
router.put('/emprestimos/:id/devolucao', inventarioController.registarDevolucao);

// POST /api/inventario/emprestimos/:id/penalizacoes — registar penalização
router.post('/emprestimos/:id/penalizacoes', autorizar('Admin'), inventarioController.registarPenalizacao);

// PUT  /api/inventario/emprestimos/:id/pagamento — registar pagamento
router.put('/emprestimos/:id/pagamento', autorizar('Admin'), inventarioController.registarPagamentoEmprestimo);

// ── VENDAS ────────────────────────────────────────────────────────────────────
// POST /api/inventario/vendas — colocar peça à venda
router.post('/vendas', inventarioController.colocarPecaAVenda);

// PUT  /api/inventario/vendas/:id/concluir — registar conclusão de venda
router.put('/vendas/:id/concluir', autorizar('Admin'), inventarioController.registarConclusaoVenda);

module.exports = router;