const bcrypt = require('bcryptjs');
const utilizadorModel = require('../models/utilizadorModel');

// ============================================================================
// US03 / RF03 — LISTAR UTILIZADORES (Admin)
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
        if (error.message && error.message.includes('email')) {
            return res.status(409).json({ mensagem: error.message });
        }
        if (error.message && error.message.includes('Perfil')) {
            return res.status(400).json({ mensagem: error.message });
        }
        next(error);
    }
}

// ============================================================================
// US05 / RF05 — LISTAR TODOS OS ALUNOS (Admin)
// GET /api/utilizadores/alunos
// ============================================================================
async function listarAlunos(req, res, next) {
    try {
        const alunos = await utilizadorModel.listarTodosAlunos();
        return res.status(200).json(alunos);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US05 / RF05 — CRIAR ALUNO (Admin)
// POST /api/utilizadores/alunos
// Body: { nome, dataNascimento }
// ============================================================================
async function criarAluno(req, res, next) {
    try {
        const { nome, dataNascimento } = req.body;

        if (!nome) {
            return res.status(400).json({ mensagem: 'Nome do aluno é obrigatório.' });
        }

        const aluno = await utilizadorModel.criarAluno({
            nome,
            dataNascimento: dataNascimento || null
        });

        return res.status(201).json({
            mensagem: 'Aluno criado com sucesso.',
            aluno
        });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US05 / RF05 — ASSOCIAR ALUNO A EE (Admin)
// POST /api/utilizadores/associacoes/encarregado-aluno
// Body: { idEncarregado, idAluno }
// ============================================================================
async function associarEncarregadoAluno(req, res, next) {
    try {
        const { idEncarregado, idAluno } = req.body;

        if (idEncarregado == null || idAluno == null) {
            return res.status(400).json({ mensagem: 'idEncarregado e idAluno são obrigatórios.' });
        }

        const idEnc = parseInt(idEncarregado, 10);
        const idA = parseInt(idAluno, 10);
        if (Number.isNaN(idEnc) || Number.isNaN(idA)) {
            return res.status(400).json({ mensagem: 'IDs inválidos.' });
        }

        await utilizadorModel.associarEncarregadoAluno(idEnc, idA);

        return res.status(201).json({ mensagem: 'Associação registada com sucesso.' });
    } catch (error) {
        if (error.message && error.message.includes('já está associado')) {
            return res.status(409).json({ mensagem: error.message });
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
        const idUtilizador = parseInt(req.params.id, 10);
        if (Number.isNaN(idUtilizador)) {
            return res.status(400).json({ mensagem: 'ID de utilizador inválido.' });
        }

        const { nome, telefone, perfil } = req.body;

        if (!nome) {
            return res.status(400).json({ mensagem: 'Nome é obrigatório.' });
        }

        await utilizadorModel.editarUtilizador(idUtilizador, {
            nome,
            telefone: telefone || null,
            nomePerfil: perfil || null
        });

        return res.status(200).json({ mensagem: 'Utilizador atualizado com sucesso.' });
    } catch (error) {
        if (error.message && error.message.includes('Perfil')) {
            return res.status(400).json({ mensagem: error.message });
        }
        next(error);
    }
}

// ============================================================================
// US03 / RF03 — ATIVAR / DESATIVAR UTILIZADOR (Admin)
// PATCH /api/utilizadores/:id/estado
// Body: { ativo: boolean }
// ============================================================================
async function alterarEstadoUtilizador(req, res, next) {
    try {
        const idUtilizador = parseInt(req.params.id, 10);
        if (Number.isNaN(idUtilizador)) {
            return res.status(400).json({ mensagem: 'ID de utilizador inválido.' });
        }

        const { ativo } = req.body;
        if (typeof ativo !== 'boolean') {
            return res.status(400).json({ mensagem: 'Campo ativo (boolean) é obrigatório.' });
        }

        const ok = await utilizadorModel.alterarEstadoUtilizador(idUtilizador, ativo);
        if (!ok) {
            return res.status(404).json({ mensagem: 'Utilizador não encontrado.' });
        }

        return res.status(200).json({ mensagem: `Utilizador ${ativo ? 'ativado' : 'desativado'} com sucesso.` });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US05 / RF05 — ALUNOS DO EE AUTENTICADO
// GET /api/utilizadores/meus-alunos
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
// US05 / RF05 — ALUNOS DE UM EE (Admin)
// GET /api/utilizadores/:id/alunos
// ============================================================================
async function getAlunosPorEncarregadoId(req, res, next) {
    try {
        const idEncarregado = parseInt(req.params.id, 10);
        if (Number.isNaN(idEncarregado)) {
            return res.status(400).json({ mensagem: 'ID de encarregado inválido.' });
        }

        const alunos = await utilizadorModel.getAlunosPorEncarregado(idEncarregado);
        return res.status(200).json(alunos);
    } catch (error) {
        next(error);
    }
}

module.exports = {
    listarUtilizadores,
    criarUtilizador,
    listarAlunos,
    criarAluno,
    associarEncarregadoAluno,
    editarUtilizador,
    alterarEstadoUtilizador,
    getAlunosPorEncarregado,
    getAlunosPorEncarregadoId
};
