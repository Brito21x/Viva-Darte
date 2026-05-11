/**
 * @fileoverview Rotas de Autenticação e Gestão de Utilizadores.
 * Este ficheiro atua como o "router" principal para as operações de segurança e identidade.
 * Mapeia os endpoints da API (URLs) para os respetivos métodos do Controlador (`authController`),
 * aplicando os middlewares de proteção (`autenticar`) onde necessário.
 */

const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const { autenticar } = require("../middlewares/auth");

// ============================================================================
// ROTAS DE AUTENTICAÇÃO E SESSÃO
// ============================================================================

/**
 * [PÚBLICO] Iniciar sessão no sistema.
 * Valida credenciais e devolve um Token JWT para uso nas rotas protegidas.
 * POST /api/auth/login
 */
router.post("/login", authController.login);

/**
 * [PROTEGIDO] Terminar sessão.
 * Requer que o utilizador envie um token válido. Atualmente processa o fim de sessão
 * de forma stateless (indicando ao cliente para descartar o token).
 * POST /api/auth/logout
 */
router.post("/logout", autenticar, authController.logout);

/**
 * [PÚBLICO] Iniciar o fluxo de recuperação de palavra-passe.
 * Gera e regista um token seguro temporário na base de dados para o email indicado.
 * POST /api/auth/recuperar-password
 */
router.post("/recuperar-password", authController.solicitarRecuperacaoPassword);

/**
 * [PÚBLICO] Efetivar a alteração da palavra-passe.
 * Consome o token gerado anteriormente para definir uma nova palavra-passe de forma segura.
 * POST /api/auth/redefinir-password
 */
router.post("/redefinir-password", authController.redefinirPassword);

/**
 * [PÚBLICO] Auto-registo no portal (Professores ou Encarregados de Educação).
 * A conta é criada com o estado inativo (pendente de aprovação pela Coordenação).
 * POST /api/auth/register
 */
router.post("/register", authController.register);

// ============================================================================
// ROTAS DE GESTÃO - PAINEL DE ADMINISTRAÇÃO / COORDENAÇÃO
// ============================================================================

/**
 * [PROTEGIDO] Obter a listagem global de todos os utilizadores registados.
 * GET /api/auth/utilizadores
 */
router.get("/utilizadores", autenticar, authController.listarUtilizadores);

/**
 * [PROTEGIDO] Criar um novo utilizador diretamente pelo painel administrativo.
 * Ao contrário do `/register`, as contas criadas por aqui ficam ativas de imediato.
 * POST /api/auth/utilizadores
 */
router.post("/utilizadores", autenticar, authController.adminCriarUtilizador);

/**
 * [PROTEGIDO] Atualizar integralmente os dados e o perfil de um utilizador existente.
 * PUT /api/auth/utilizadores/:id
 */
router.put(
  "/utilizadores/:id",
  autenticar,
  authController.editarUtilizadorCompleto,
);

/**
 * [PROTEGIDO] Aprovar/Ativar um utilizador.
 * Utilizado para aceitar auto-registos pendentes ou reativar contas suspensas.
 * PUT /api/auth/utilizadores/:id/ativar
 */
router.put(
  "/utilizadores/:id/ativar",
  autenticar,
  authController.ativarUtilizador,
);

/**
 * [PROTEGIDO] Suspender/Desativar o acesso de um utilizador.
 * O utilizador não é apagado, mas perde imediatamente o acesso ao sistema (o JWT é barrado).
 * PUT /api/auth/utilizadores/:id/desativar
 */
router.put(
  "/utilizadores/:id/desativar",
  autenticar,
  authController.desativarUtilizador,
);

/**
 * [PROTEGIDO] Apagar permanentemente um utilizador.
 * Remove de forma irreversível o registo e as dependências autorizadas na base de dados.
 * DELETE /api/auth/utilizadores/:id
 */
router.delete(
  "/utilizadores/:id",
  autenticar,
  authController.eliminarUtilizador,
);

/**
 * [PROTEGIDO] Atualizar apenas as modalidades de um professor.
 * PUT /api/auth/utilizadores/:id/modalidades
 */
router.put(
  "/utilizadores/:id/modalidades",
  autenticar,
  authController.atualizarModalidades,
);

router.get("/me/alunos", autenticar, authController.getMeusAlunos);

router.post("/me/alunos", autenticar, authController.criarMeuAluno);

// Exportação do router para ser consumido no entry point da aplicação (ex: app.js)
module.exports = router;
