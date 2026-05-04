const express = require('express');
const router = express.Router();

const faturacaoController = require('../controllers/faturacaoController');
const { autenticar, autorizar } = require('../middlewares/auth');

router.use(autenticar);

// GET  /api/faturacao/precos — tabela de preços (Coordenação)
router.get('/precos', autorizar('Admin'), faturacaoController.getTabelaPrecos);

// US15 / RF17 — criar, atualizar, desativar preço (antes de rotas com :id genérico)
router.post('/precos', autorizar('Admin'), faturacaoController.criarPreco);
router.put('/precos/:idPreco', autorizar('Admin'), faturacaoController.atualizarPreco);
router.delete('/precos/:idPreco', autorizar('Admin'), faturacaoController.desativarPreco);

// US16 / RF18 — cálculo de custo (EE no pedido; Admin na configuração)
router.get('/calcular', autorizar('EE', 'Admin'), faturacaoController.calcularCusto);

// POST /api/faturacao/gerar — gerar fatura de um utilizador (Coordenação)
router.post('/gerar', autorizar('Admin'), faturacaoController.gerarFaturacao);

// POST /api/faturacao/gerar-todos — gerar faturas de todos os EE (Coordenação)
router.post('/gerar-todos', autorizar('Admin'), faturacaoController.gerarFaturacaoTodos);

// GET  /api/faturacao — todas as faturas (Contabilidade/Admin)
router.get('/', autorizar('Admin'), faturacaoController.getFaturacao);

// GET  /api/faturacao/minha — faturas do EE autenticado
router.get('/minha', autorizar('EE'), faturacaoController.getMinhaFaturacao);

// GET  /api/faturacao/exportar?mes=&ano= — exportação (Contabilidade)
router.get('/exportar', autorizar('Admin'), faturacaoController.exportarFaturacao);

// PUT  /api/faturacao/:id/pagar — registar pagamento (Coordenação/Contabilidade)
router.put('/:id/pagar', autorizar('Admin'), faturacaoController.registarPagamento);

// US29 / RF27 — histórico (próprio ou, com permissão, outro id)
router.get(
    '/historico',
    autorizar('Admin', 'Professor', 'EE'),
    faturacaoController.getHistorico
);

router.get(
    '/historico/:id',
    autorizar('Admin', 'Professor', 'EE'),
    faturacaoController.getHistoricoUtilizador
);

// GET  /api/faturacao/relatorio?mes=&ano= — relatório por professor (Admin)
router.get('/relatorio', autorizar('Admin'), faturacaoController.getRelatorio);

module.exports = router;