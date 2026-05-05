const bcrypt = require('bcryptjs');
const utilizadorModel = require('../models/utilizadorModel');

// ============================================================================
// US03 / RF03 — LISTAR TODOS OS UTILIZADORES (Admin)
// GET /api/utilizadores
// ============================================================================
async function listarUtilizadores(req, res, next) {
    try {
        const utilizadores = await utilizadorModel.listarTodosUtilizadores();
        return res.status(200).json(utilizadores);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US03 / RF03 — CRIAR UTILIZADOR (Admin)
// POST /api/utilizadores
// Body: { nome, email, password, telefone, perfil }
// Perfil: 'Admin' | 'Professor' | 'EE'
// ============================================================================
async function criarUtilizador(req, res, next) {
    try {
        const { nome, email, password, telefone, perfil } = req.body;

        if (!nome || !email || !password || !perfil) {
            return res.status(400).json({ mensagem: 'Nome, email, password e perfil são obrigatórios.' });
        }

        const perfisValidos = ['Admin', 'Professor', 'EE'];
        if (!perfisValidos.includes(perfil)) {
            return res.status(400).json({
                mensagem: `Perfil inválido. Valores aceites: ${perfisValidos.join(', ')}.`
            });
        }

        if (password.length < 8) {
            return res.status(400).json({ mensagem: 'A password deve ter pelo menos 8 caracteres.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const novoUtilizador = await utilizadorModel.criarUtilizador({
            nome,
            email,
            passwordHash,
            telefone: telefone || null,
            nomePerfil: perfil
        });

        return res.status(201).json({
            mensagem: 'Utilizador criado com sucesso.',
            utilizador: novoUtilizador
        });
    } catch (error) {
        if (error.message.includes('email')) {
            return res.status(409).json({ mensagem: error.message });
        }
        if (error.message.includes('Perfil')) {
            return res.status(400).json({ mensagem: error.message });
        }
        next(error);
    }
}

// ============================================================================
// US03 / RF03 — EDITAR UTILIZADOR (Admin)
// PUT /api/utilizadores/:id
// Body: { nome, telefone, perfil }
// ============================================================================
async function editarUtilizador(req, res, next) {
    try {
        const idUtilizador = parseInt(req.params.id);
        const { nome, telefone, perfil } = req.body;

        if (!nome) {
            return res.status(400).json({ mensagem: 'Nome é obrigatório.' });
        }

        if (perfil) {
            const perfisValidos = ['Admin', 'Professor', 'EE'];
            if (!perfisValidos.includes(perfil)) {
                return res.status(400).json({
                    mensagem: `Perfil inválido. Valores aceites: ${perfisValidos.join(', ')}.`
                });
            }
        }

        const sucesso = await utilizadorModel.editarUtilizador(idUtilizador, {
            nome,
            telefone: telefone || null,
            nomePerfil: perfil || null
        });

        if (!sucesso) {
            return res.status(404).json({ mensagem: 'Utilizador não encontrado.' });
        }

        return res.status(200).json({ mensagem: 'Utilizador atualizado com sucesso.' });
    } catch (error) {
        if (error.message.includes('Perfil')) {
            return res.status(400).json({ mensagem: error.message });
        }
        next(error);
    }
}

// ============================================================================
// US03 / RF03 — ATIVAR / DESATIVAR CONTA (Admin)
// PATCH /api/utilizadores/:id/estado
// Body: { ativo: true | false }
// ============================================================================
async function alterarEstadoUtilizador(req, res, next) {
    try {
        const idUtilizador = parseInt(req.params.id);
        const { ativo } = req.body;

        if (typeof ativo !== 'boolean') {
            return res.status(400).json({ mensagem: 'O campo "ativo" deve ser true ou false.' });
        }

        // Impedir que o admin desative a sua própria conta
        if (req.utilizador?.id === idUtilizador && !ativo) {
            return res.status(400).json({ mensagem: 'Não pode desativar a sua própria conta.' });
        }

        const sucesso = await utilizadorModel.alterarEstadoUtilizador(idUtilizador, ativo);

        if (!sucesso) {
            return res.status(404).json({ mensagem: 'Utilizador não encontrado.' });
        }

        const estadoTexto = ativo ? 'ativada' : 'desativada';
        return res.status(200).json({ mensagem: `Conta ${estadoTexto} com sucesso.` });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US05 / RF05 — LISTAR ALUNOS DE UM ENCARREGADO
// GET /api/utilizadores/meus-alunos
// (usa o id do utilizador autenticado via JWT)
// ============================================================================
async function getAlunosPorEncarregado(req, res, next) {
    try {
        const idEncarregado = req.utilizador.id;

        const alunos = await utilizadorModel.getAlunosPorEncarregado(idEncarregado);
        return res.status(200).json(alunos);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US05 / RF05 — LISTAR ALUNOS DE UM ENCARREGADO ESPECÍFICO (Admin/Coordenação)
// GET /api/utilizadores/:id/alunos
// ============================================================================
async function getAlunosPorEncarregadoId(req, res, next) {
    try {
        const idEncarregado = parseInt(req.params.id);

        const alunos = await utilizadorModel.getAlunosPorEncarregado(idEncarregado);
        return res.status(200).json(alunos);
    } catch (error) {
        next(error);
    }
}

module.exports = {
    listarUtilizadores,
    criarUtilizador,
    editarUtilizador,
    alterarEstadoUtilizador,
    getAlunosPorEncarregado,
    getAlunosPorEncarregadoId
};