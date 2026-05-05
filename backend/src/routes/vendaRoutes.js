// Localização: backend/src/routes/vendaRoutes.js
const express = require('express');
const router = express.Router();
const vendaController = require('../controllers/vendaController');

// Define as rotas HTTP para as operações
router.get('/', vendaController.getVendas);
router.post('/', vendaController.criarVenda);
router.put('/:id', vendaController.atualizarVenda);
router.delete('/:id', vendaController.apagarVenda);

module.exports = router;