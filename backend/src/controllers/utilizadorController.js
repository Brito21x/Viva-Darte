const bcrypt = require('bcryptjs');
const utilizadorModel = require('../models/utilizadorModel');

async function listarUtilizadores(req, res, next) {
    try {
        const lista = await utilizadorModel.listarTodosUtilizadores();
        return res.status(200).json(lista);
    } catch (error) {
        next(error);
    }
}

async function criarUtilizadorAdmin(req, res, next) {
    try {
        const { nome, email, telefone, password, tipo, idsModalidades } = req.body;

        if (!nome || !email || !password || !tipo) {
            return res.status(400).json({ mensagem: 'Nome, email, password e tipo (PROF ou EE) são obrigatórios.' });
        }

        const nomePerfil = tipo === 'PROF' ? 'Professor' : 'Encarregado';
        let idsModalidadesProf;
        if (tipo === 'PROF') {
            idsModalidadesProf = Array.isArray(idsModalidades) ? idsModalidades : [];
            if (idsModalidadesProf.length === 0) {
                return res.status(400).json({
                    mensagem: 'Para professor, indica pelo menos uma modalidade (idsModalidades).'
                });
            }
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const novo = await utilizadorModel.criarUtilizador({
            nome,
            email,
            passwordHash,
            telefone,
            nomePerfil,
            idsModalidades: idsModalidadesProf
        });

        return res.status(201).json({ mensagem: 'Utilizador criado.', utilizador: novo });
    } catch (error) {
        if (error.message === 'Já existe um utilizador com este email.') {
            return res.status(400).json({ mensagem: error.message });
        }
        if (error.message && error.message.startsWith('PERFIL_NAO_ENCONTRADO')) {
            const perfisNaBd = error.message.split(':')[1];
            return res.status(400).json({
                mensagem: `Perfil não encontrado na BD. Perfis existentes: ${perfisNaBd}`
            });
        }
        next(error);
    }
}

async function editarUtilizador(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ mensagem: 'ID inválido.' });
        }

        const { nome, telefone, nomePerfil } = req.body;
        if (!nome) {
            return res.status(400).json({ mensagem: 'Nome é obrigatório.' });
        }

        const ok = await utilizadorModel.editarUtilizador(id, { nome, telefone, nomePerfil });
        if (!ok) {
            return res.status(404).json({ mensagem: 'Utilizador não encontrado.' });
        }
        return res.status(200).json({ mensagem: 'Utilizador atualizado.' });
    } catch (error) {
        next(error);
    }
}

async function alterarEstado(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ mensagem: 'ID inválido.' });
        }

        const { ativo } = req.body;
        if (typeof ativo !== 'boolean') {
            return res.status(400).json({ mensagem: 'Campo "ativo" (boolean) é obrigatório.' });
        }

        const ok = await utilizadorModel.alterarEstadoUtilizador(id, ativo);
        if (!ok) {
            return res.status(404).json({ mensagem: 'Utilizador não encontrado.' });
        }
        return res.status(200).json({ mensagem: ativo ? 'Conta ativada.' : 'Conta desativada.' });
    } catch (error) {
        next(error);
    }
}

async function getMeusAlunos(req, res, next) {
    try {
        const idEncarregado = req.utilizador?.id;
        if (idEncarregado == null) {
            return res.status(401).json({ mensagem: 'Sessão inválida.' });
        }
        const alunos = await utilizadorModel.getAlunosPorEncarregado(idEncarregado);
        return res.status(200).json(alunos);
    } catch (error) {
        next(error);
    }
}

module.exports = {
    listarUtilizadores,
    criarUtilizadorAdmin,
    editarUtilizador,
    alterarEstado,
    getMeusAlunos
};
