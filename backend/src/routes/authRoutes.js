/**
 * @fileoverview Rotas de Autenticação e Gestão de Utilizadores.
 * @description Este ficheiro atua como o "router" principal para as operações de segurança e identidade.
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
 * @route POST /api/auth/login
 * @description Iniciar sessão no sistema. Valida credenciais e devolve um Token JWT para uso nas rotas protegidas.
 * @access Público
 */
router.post("/login", authController.login);

/**
 * @route POST /api/auth/logout
 * @description Terminar sessão. Requer que o utilizador envie um token válido.
 * Processa o fim de sessão registando na auditoria.
 * @access Protegido (Requer token JWT)
 */
router.post("/logout", autenticar, authController.logout);

/**
 * @route POST /api/auth/recuperar-password
 * @description Iniciar o fluxo de recuperação de palavra-passe. Gera e regista um token seguro temporário na base de dados para o email indicado.
 * @access Público
 */
router.post("/recuperar-password", authController.solicitarRecuperacaoPassword);

/**
 * @route POST /api/auth/redefinir-password
 * @description Efetivar a alteração da palavra-passe. Consome o token gerado anteriormente para definir uma nova palavra-passe de forma segura.
 * @access Público
 */
router.post("/redefinir-password", authController.redefinirPassword);

/**
 * @route POST /api/auth/register
 * @description Auto-registo no portal (Professores ou Encarregados de Educação). A conta é criada com o estado inativo (pendente de aprovação pela Coordenação).
 * @access Público
 */
router.post("/register", authController.register);

// ============================================================================
// ROTAS DE GESTÃO - PAINEL DE ADMINISTRAÇÃO / COORDENAÇÃO
// ============================================================================

/**
 * @route GET /api/auth/utilizadores
 * @description Obter a listagem global de todos os utilizadores registados.
 * @access Protegido
 */
router.get("/utilizadores", autenticar, authController.listarUtilizadores);

/**
 * @route POST /api/auth/utilizadores
 * @description Criar um novo utilizador diretamente pelo painel administrativo. As contas criadas por aqui ficam ativas de imediato.
 * @access Protegido
 */
router.post("/utilizadores", autenticar, authController.adminCriarUtilizador);

/**
 * @route PUT /api/auth/utilizadores/:id
 * @description Atualizar integralmente os dados e o perfil de um utilizador existente.
 * @access Protegido
 */
router.put(
  "/utilizadores/:id",
  autenticar,
  authController.editarUtilizadorCompleto,
);

/**
 * @route PUT /api/auth/utilizadores/:id/ativar
 * @description Aprovar/Ativar um utilizador. Utilizado para aceitar auto-registos pendentes ou reativar contas suspensas.
 * @access Protegido
 */
router.put(
  "/utilizadores/:id/ativar",
  autenticar,
  authController.ativarUtilizador,
);

/**
 * @route PUT /api/auth/utilizadores/:id/desativar
 * @description Suspender/Desativar o acesso de um utilizador. O utilizador não é apagado, mas perde imediatamente o acesso ao sistema.
 * @access Protegido
 */
router.put(
  "/utilizadores/:id/desativar",
  autenticar,
  authController.desativarUtilizador,
);

/**
 * @route DELETE /api/auth/utilizadores/:id
 * @description Apagar permanentemente um utilizador. Remove de forma irreversível o registo e as dependências na base de dados.
 * @access Protegido
 */
router.delete(
  "/utilizadores/:id",
  autenticar,
  authController.eliminarUtilizador,
);

/**
 * @route PUT /api/auth/utilizadores/:id/modalidades
 * @description Atualizar apenas as modalidades letivas de um professor.
 * @access Protegido
 */
router.put(
  "/utilizadores/:id/modalidades",
  autenticar,
  authController.atualizarModalidades,
);

// ============================================================================
// ROTAS DE GESTÃO DO ENCARREGADO DE EDUCAÇÃO
// ============================================================================

/**
 * @route GET /api/auth/me/alunos
 * @description Consulta os educandos/alunos associados à conta do Encarregado de Educação com sessão iniciada.
 * @access Protegido
 */
router.get("/me/alunos", autenticar, authController.getMeusAlunos);

/**
 * @route POST /api/auth/me/alunos
 * @description Adiciona um novo educando/aluno à conta do Encarregado de Educação autenticado.
 * @access Protegido
 */
router.post("/me/alunos", autenticar, authController.criarMeuAluno);

/**
 * @module authRoutes
 */
module.exports = router;
