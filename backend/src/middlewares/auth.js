/**
 * @fileoverview Middlewares de Autenticação e Autorização.
 * Garante a segurança das rotas, validação de tokens JWT, verificação de privilégios 
 * e validação em tempo real do estado da conta na Base de Dados.
 */

const jwt = require('jsonwebtoken');

// Importar o model para permitir a validação do estado ativo/inativo em tempo real.
const utilizadorModel = require('../models/authModel');

/**
 * Verifica se a lista de perfis (nomes na BD) satisfaz o perfil requerido nas rotas.
 * A função é flexível para lidar com variações e abreviaturas de nomenclaturas de perfis.
 * * @param {Array<string>} perfisUtilizador - Lista de perfis que o utilizador autenticado possui.
 * @param {string} perfilRequerido - O perfil exigido para aceder à rota.
 * @returns {boolean} - Retorna true se o utilizador possuir o perfil adequado.
 */
function utilizadorTemPerfil(perfisUtilizador, perfilRequerido) {
    const lista = perfisUtilizador || [];
    const r = String(perfilRequerido);

    if (r === 'EE') {
        return lista.some(p => {
            const s = String(p).toLowerCase();
            return s.includes('encarregado') || s === 'ee' || s.includes('educação') || s.includes('educacao');
        });
    }

    if (r === 'Professor') {
        return lista.some(p => String(p).toLowerCase().includes('prof'));
    }

    if (r === 'Admin') {
        return lista.some((p) => {
            const s = String(p).toLowerCase();
            return (
                s === 'admin' ||
                s.includes('admin') ||
                s.includes('coordenação') ||
                s.includes('coordenacao') ||
                s.includes('administração') ||
                s.includes('administracao')
            );
        });
    }

    return lista.some(p => String(p) === r);
}

// ============================================================================
// MIDDLEWARE DE AUTENTICAÇÃO — Verifica o token JWT em todas as rotas protegidas
// ============================================================================

/**
 * Middleware de Autenticação.
 * Descodifica o token JWT e verifica na Base de Dados se a conta continua ativa.
 * Caso o administrador tenha desativado a conta, o acesso é revogado imediatamente.
 */
async function autenticar(req, res, next) {
    // 1. Extração do Token do Cabeçalho
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ mensagem: 'Acesso negado. Token não fornecido.' });
    }

    try {
        // 2. Descodificação e Validação Matemática do JWT
        // Usa o secret definido nas variáveis de ambiente
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'segredo_super_seguro_123');

        // 3. Validação do Estado na Base de Dados (Em Tempo Real)
        // Utilizamos o email do payload para consultar os dados atuais do utilizador
        const utilizadorBD = await utilizadorModel.getUtilizadorByEmail(payload.email);

        // Se o utilizador foi completamente apagado da base de dados
        if (!utilizadorBD) {
            return res.status(401).json({ mensagem: 'O utilizador associado a este token já não existe.' });
        }

        // Se o utilizador existe, mas o Administrador o desativou/revogou o acesso
        if (!utilizadorBD.ativo) {
            return res.status(403).json({ 
                mensagem: 'Sessão revogada. A sua conta foi desativada pela administração.',
                tokenExpirado: true // Permite ao frontend identificar o erro para limpar localStorage e fazer logout
            });
        }

        // 4. Injeção dos Dados no Request para Controladores e Middleware de Autorização
        req.utilizador = { 
            id: payload.id, 
            nome: payload.nome, 
            email: payload.email, 
            perfis: payload.perfis,
            perfil: payload.perfil
        };
        
        next();
    } catch (error) {
        // Tratamento específico de erros para guiar o frontend
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ mensagem: 'O seu token expirou. Por favor, inicie sessão novamente.' });
        }
        return res.status(401).json({ mensagem: 'Token inválido ou corrompido.' });
    }
}

// ============================================================================
// MIDDLEWARE DE AUTORIZAÇÃO — Verifica se o utilizador tem o perfil necessário
// Uso: autorizar('Admin') | autorizar('Professor', 'Admin')
// ============================================================================

/**
 * Middleware de Autorização Baseada em Funções (Role-Based Access Control).
 * Confirma se o utilizador (já autenticado) tem permissões para aceder ao recurso.
 * * @param  {...string} perfisPermitidos - Nomes dos perfis autorizados (ex: 'Admin', 'EE').
 */
function autorizar(...perfisPermitidos) {
    return (req, res, next) => {
        // Obtém os perfis do utilizador que foram injetados pelo middleware `autenticar`
        const perfisUtilizador = req.utilizador?.perfis || [];
        
        // Verifica se há correspondência entre o que o utilizador tem e o que a rota exige
        const temPermissao = perfisPermitidos.some(p => utilizadorTemPerfil(perfisUtilizador, p));

        if (!temPermissao) {
            return res.status(403).json({
                mensagem: `Acesso negado. Perfil necessário: ${perfisPermitidos.join(' ou ')}.`
            });
        }

        next();
    };
}

module.exports = { autenticar, autorizar, utilizadorTemPerfil };