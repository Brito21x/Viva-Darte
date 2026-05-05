const express = require('express');
const router = express.Router();

const faturacaoController = require('../controllers/faturacaoController');
const { autenticar, autorizar } = require('../middlewares/auth');

router.use(autenticar);

// GET  /api/faturacao/precos — tabela de preços (Coordenação)
router.get('/precos', autorizar('Admin'), faturacaoController.getTabelaPrecos);

// GET  /api/faturacao/calcular?formato=&duracao=&diaSemana=&idModalidade=&idProfessor=
router.get('/calcular', faturacaoController.calcularCusto);

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

// GET  /api/faturacao/historico — histórico do utilizador autenticado
router.get('/historico', faturacaoController.getHistorico);

// GET  /api/faturacao/historico/:id — histórico de utilizador específico (Admin)
router.get('/historico/:id', autorizar('Admin'), faturacaoController.getHistoricoUtilizador);

// GET  /api/faturacao/relatorio?mes=&ano= — relatório por professor (Admin)
router.get('/relatorio', autorizar('Admin'), faturacaoController.getRelatorio);

module.exports = router;