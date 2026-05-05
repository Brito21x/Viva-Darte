const express = require('express');
const router = express.Router();

const inventarioController = require('../controllers/inventarioController');
const { autenticar, autorizar } = require('../middlewares/auth');

router.use(autenticar);

// ── CATÁLOGO ──────────────────────────────────────────────────────────────────
// GET  /api/inventario
router.get('/', inventarioController.getCatalogo);

// GET  /api/inventario/vendas — peças à venda (antes de /:id para não colidir)
// Qualquer utilizador autenticado pode consultar peças à venda
router.get('/vendas', inventarioController.getPecasAVenda);

// GET  /api/inventario/:id — detalhe de peça
router.get('/:id', inventarioController.getPecaDetalhes);

// POST /api/inventario — registar peça
router.post('/', inventarioController.registarPeca);

// PUT  /api/inventario/:id — atualizar estado/disponibilidade
router.put('/:id', inventarioController.atualizarEstadoPeca);

// ── EMPRÉSTIMOS ───────────────────────────────────────────────────────────────
// POST /api/inventario/emprestimos — requisitar empréstimo (Admin pode fazer em nome de utilizador)
router.post('/emprestimos', inventarioController.requisitarEmprestimo);

// PUT  /api/inventario/emprestimos/:id/devolucao — registar devolução
router.put('/emprestimos/:id/devolucao', inventarioController.registarDevolucao);

// POST /api/inventario/emprestimos/:id/penalizacoes — registar penalização (só Admin/Coordenação)
router.post('/emprestimos/:id/penalizacoes', autorizar('Admin'), inventarioController.registarPenalizacao);

// PUT  /api/inventario/emprestimos/:id/pagamento — registar pagamento (só Admin/Coordenação)
router.put('/emprestimos/:id/pagamento', autorizar('Admin'), inventarioController.registarPagamentoEmprestimo);

// ── VENDAS ────────────────────────────────────────────────────────────────────
// NOTA: US27/US28 — Venda é um processo entre utilizadores (EE/Professor).
// A Administração/Coordenação NÃO coloca peças à venda nem conclui vendas.
// Admin pode CONSULTAR vendas para controlo, mas não iniciar/concluir o processo.

// POST /api/inventario/vendas — colocar peça à venda (apenas EE e Professor, NÃO Admin)
router.post('/vendas', autorizar('EE', 'Professor'), inventarioController.colocarPecaAVenda);

// PUT  /api/inventario/vendas/:id/concluir — registar conclusão de venda
// Responsável = dono da peça (EE ou Professor), NÃO Admin diretamente
router.put('/vendas/:id/concluir', autorizar('EE', 'Professor'), inventarioController.registarConclusaoVenda);

module.exports = router;