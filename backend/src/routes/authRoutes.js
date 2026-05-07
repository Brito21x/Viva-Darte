/**
 * Rotas de Autenticação e Gestão de Utilizadores
 * Este ficheiro mapeia os endpoints da API (URLs) para os respetivos métodos do Controlador.
 */

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController'); // Funções de lógica de negócio
const { autenticar } = require('../middlewares/auth');

// ============================================================================
// ROTAS DE AUTENTICAÇÃO 
// ============================================================================

// [PÚBLICO] Iniciar sessão e obter o Token JWT
router.post('/login', authController.login);

// [PROTEGIDO] Terminar sessão (Requer que o utilizador esteja autenticado)
router.post('/logout', autenticar, authController.logout);

// [PÚBLICO] Iniciar o fluxo de recuperação de password (geração de token)
router.post('/recuperar-password', authController.solicitarRecuperacaoPassword);

// [PÚBLICO] Efetivar a alteração da password através do token recebido
router.post('/redefinir-password', authController.redefinirPassword);

// [PÚBLICO] Criar uma nova conta a partir do portal exterior (fica pendente de aprovação)
router.post('/register', authController.register);


// ============================================================================
// ROTAS DE GESTÃO - PAINEL DE ADMINISTRAÇÃO
// ============================================================================

// [PROTEGIDO] Obter a listagem de todos os utilizadores
router.get('/utilizadores', autenticar, authController.listarUtilizadores);

// [PROTEGIDO] Criar um novo utilizador diretamente pelo painel
router.post('/utilizadores', autenticar, authController.adminCriarUtilizador);

// [PROTEGIDO] Atualizar todos os dados de um utilizador existente
router.put('/utilizadores/:id', autenticar, authController.editarUtilizadorCompleto);

// [PROTEGIDO] Aprovar/Ativar um utilizador que estava pendente ou suspenso
router.put('/utilizadores/:id/ativar', autenticar, authController.ativarUtilizador);

// [PROTEGIDO] Suspender/Desativar o acesso de um utilizador
router.put('/utilizadores/:id/desativar', autenticar, authController.desativarUtilizador);

// [PROTEGIDO] Apagar permanentemente um utilizador e as suas ligações da base de dados
router.delete('/utilizadores/:id', autenticar, authController.eliminarUtilizador);

module.exports = router;