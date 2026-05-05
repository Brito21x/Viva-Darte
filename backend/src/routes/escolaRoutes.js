const express = require('express');
const router = express.Router();

const escolaController = require('../controllers/escolaController');
const { autenticar, autorizar } = require('../middlewares/auth');

router.use(autenticar);

// GET /api/escola/anos-letivos
router.get('/anos-letivos', escolaController.getAnosLetivos);

// GET /api/escola/modalidades
router.get('/modalidades', escolaController.getModalidades);

// GET /api/escola/salas
router.get('/salas', escolaController.getSalas);

// GET /api/escola/compatibilidade — matriz salas ↔ modalidades
router.get('/compatibilidade', escolaController.getCompatibilidade);

// GET /api/escola/modalidades/:id/salas
router.get('/modalidades/:id/salas', escolaController.getSalasPorModalidade);

// GET /api/escola/modalidades/:id/professores — dropdown para pedido de coaching (US05)
router.get('/modalidades/:id/professores', escolaController.getProfessoresPorModalidade);

// GET /api/escola/professores/:id/modalidades
router.get('/professores/:id/modalidades', escolaController.getModalidadesPorProfessor);

// POST /api/escola/professores/:id/modalidades — associar (Coordenação) (US11)
router.post('/professores/:id/modalidades', autorizar('Admin'), escolaController.associarProfessorModalidade);

// DELETE /api/escola/professores/:id/modalidades/:idModalidade — remover associação (Coordenação)
router.delete('/professores/:id/modalidades/:idModalidade', autorizar('Admin'), escolaController.removerProfessorModalidade);

module.exports = router;