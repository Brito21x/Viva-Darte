/**
 * Rotas do Inventário, Empréstimos e Mercado de vendas de figurinos
 * Este ficheiro define todos os endpoints da API relacionados com a gestão física
 * das peças (Empréstimo e venda).
 */

const express = require('express');
const router = express.Router();

const inventarioController = require('../controllers/inventarioController'); // Controlador com a lógica de negócio
const { autenticar, autorizar } = require('../middlewares/auth');

// ============================================================================
// MIDDLEWARE GLOBAL DA ROTA
// ============================================================================
// Aplica a verificação de token (autenticar) a TODAS as rotas declaradas abaixo.
// Isto garante que o Catálogo e o Mercado são exclusivos para a comunidade escolar registada.
router.use(autenticar);

// ============================================================================
// CATÁLOGO E GESTÃO BASE DE PEÇAS 
// ============================================================================

// [GET] Listar todas as peças disponíveis no inventário da escola
router.get('/', inventarioController.getCatalogo);

// [GET] Listar especificamente as peças que estão no mercado de vendas
router.get('/vendas', inventarioController.getPecasAVenda);

// [GET] Obter os detalhes completos de uma peça específica e respetiva galeria de fotos
router.get('/:id', inventarioController.getPecaDetalhes);

// [POST] Registar uma nova peça no sistema
router.post('/', inventarioController.registarPeca);

// [PUT] Atualizar configurações da peça
router.put('/:id', inventarioController.atualizarEstadoPeca);


// ============================================================================
// CICLO DE EMPRÉSTIMOS 
// ============================================================================

// [POST] Efetuar um novo pedido de requisição/empréstimo de uma peça
router.post('/emprestimos', inventarioController.requisitarEmprestimo);

// [PUT] Registar a devolução física de uma peça (inclui avaliação de danos)
router.put('/emprestimos/:id/devolucao', inventarioController.registarDevolucao);

// [POST] Aplicar multas/penalizações a um empréstimo (ex: Atraso, Dano, Perda)
router.post('/emprestimos/:id/penalizacoes', inventarioController.registarPenalizacao);

// [PUT] Registar o pagamento de taxas associadas a um empréstimo
router.put('/emprestimos/:id/pagamento', inventarioController.registarPagamentoEmprestimo);


// ============================================================================
//  MERCADO DE VENDAS 
// ============================================================================

// [POST] Promover uma peça do inventário para o mercado de vendas (Anunciar)
router.post('/vendas', inventarioController.colocarPecaAVenda);

// [PUT] Finalizar uma venda (Registar o comprador e o método de pagamento recebido)
router.put('/vendas/:id/concluir', inventarioController.registarConclusaoVenda);

// [PUT] Edição global de uma peça (Altera nome, descrição, preços e atualiza fotografias)
router.put('/:id/editar', inventarioController.editarPeca);

// [DELETE] Apagar permanentemente uma peça do sistema (Eliminação em Cascata de Empréstimos e Fotos)
router.delete('/:id', inventarioController.apagarPeca);

module.exports = router;