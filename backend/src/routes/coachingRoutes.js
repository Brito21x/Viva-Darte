const express = require('express');
const router = express.Router();

const coachingController = require('../controllers/coachingController');
const { autenticar, autorizar } = require('../middlewares/auth');

router.use(autenticar);

// ── DISPONIBILIDADES (Professor) ──────────────────────────────────────────────
// GET  /api/coaching/disponibilidades
router.get('/disponibilidades', autorizar('Professor'), coachingController.getDisponibilidades);

// POST /api/coaching/disponibilidades
router.post('/disponibilidades', autorizar('Professor'), coachingController.adicionarDisponibilidade);

// DELETE /api/coaching/disponibilidades/:id
router.delete('/disponibilidades/:id', autorizar('Professor'), coachingController.removerDisponibilidade);

// ── VAGAS DISPONÍVEIS (EE) ────────────────────────────────────────────────────
// GET  /api/coaching/vagas?idModalidade=&diaSemana=&data=
router.get('/vagas', autorizar('EE'), coachingController.getVagasDisponiveis);

// ── AGENDA DO PROFESSOR ───────────────────────────────────────────────────────
// GET  /api/coaching/agenda?dataInicio=&dataFim=
router.get('/agenda', autorizar('Professor'), coachingController.getAgenda);

// ── PEDIDOS ───────────────────────────────────────────────────────────────────
// POST /api/coaching/pedidos — submeter pedido (EE)
router.post('/pedidos', autorizar('EE'), coachingController.criarPedidoCoaching);

// GET  /api/coaching/pedidos/pendentes — pedidos para tratar (Coordenação)
router.get('/pedidos/pendentes', autorizar('Admin'), coachingController.getPedidosPendentes);

// POST /api/coaching/pedidos/:id/aprovar — aprovar e agendar (Coordenação)
router.post('/pedidos/:id/aprovar', autorizar('Admin'), coachingController.aprovarPedido);

// POST /api/coaching/pedidos/:id/rejeitar — rejeitar com justificação (Coordenação)
router.post('/pedidos/:id/rejeitar', autorizar('Admin'), coachingController.rejeitarPedido);

// ── COACHINGS AGENDADOS ───────────────────────────────────────────────────────
// DELETE /api/coaching/:id — cancelar coaching (EE ou Coordenação)
router.delete('/:id', autorizar('EE', 'Admin'), coachingController.cancelarCoaching);

// POST /api/coaching/:id/validar — confirmar realização (Professor ou EE)
router.post('/:id/validar', autorizar('Professor', 'EE'), coachingController.registarValidacao);

// POST /api/coaching/:id/concluir — conclusão final (Coordenação)
router.post('/:id/concluir', autorizar('Admin'), coachingController.concluirCoaching);

module.exports = router;