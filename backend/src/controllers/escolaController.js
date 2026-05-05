const escolaModel = require('../models/escolaModel');

// ============================================================================
// ANOS LETIVOS
// GET /api/escola/anos-letivos
// ============================================================================
async function getAnosLetivos(req, res, next) {
    try {
        const anos = await escolaModel.getAnosLetivos();
        return res.status(200).json(anos);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// MODALIDADES
// GET /api/escola/modalidades
// ============================================================================
async function getModalidades(req, res, next) {
    try {
        const modalidades = await escolaModel.getModalidadesAtivas();
        return res.status(200).json(modalidades);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// SALAS
// GET /api/escola/salas
// ============================================================================
async function getSalas(req, res, next) {
    try {
        const salas = await escolaModel.getSalas();
        return res.status(200).json(salas);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// COMPATIBILIDADE SALAS ↔ MODALIDADES (matriz completa)
// GET /api/escola/compatibilidade
// ============================================================================
async function getCompatibilidade(req, res, next) {
    try {
        const compatibilidade = await escolaModel.getCompatibilidadeSalasModalidades();
        return res.status(200).json(compatibilidade);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// SALAS POR MODALIDADE (para formulário de aprovação)
// GET /api/escola/modalidades/:id/salas
// ============================================================================
async function getSalasPorModalidade(req, res, next) {
    try {
        const idModalidade = parseInt(req.params.id);

        if (isNaN(idModalidade)) {
            return res.status(400).json({ mensagem: 'ID de modalidade inválido.' });
        }

        const salas = await escolaModel.getSalasPorModalidade(idModalidade);
        return res.status(200).json(salas);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// PROFESSORES POR MODALIDADE (US05 — dropdown no pedido de coaching)
// GET /api/escola/modalidades/:id/professores
// ============================================================================
async function getProfessoresPorModalidade(req, res, next) {
    try {
        const idModalidade = parseInt(req.params.id);

        if (isNaN(idModalidade)) {
            return res.status(400).json({ mensagem: 'ID de modalidade inválido.' });
        }

        const professores = await escolaModel.getProfessoresPorModalidade(idModalidade);
        return res.status(200).json(professores);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// MODALIDADES POR PROFESSOR
// GET /api/escola/professores/:id/modalidades
// ============================================================================
async function getModalidadesPorProfessor(req, res, next) {
    try {
        const idProfessor = parseInt(req.params.id);

        if (isNaN(idProfessor)) {
            return res.status(400).json({ mensagem: 'ID de professor inválido.' });
        }

        const modalidades = await escolaModel.getModalidadesPorProfessor(idProfessor);
        return res.status(200).json(modalidades);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US11 / RF13 — ASSOCIAR PROFESSOR A MODALIDADE (Coordenação)
// POST /api/escola/professores/:id/modalidades
// Body: { idModalidade }
// ============================================================================
async function associarProfessorModalidade(req, res, next) {
    try {
        const idProfessor = parseInt(req.params.id);
        const { idModalidade } = req.body;

        if (isNaN(idProfessor) || !idModalidade) {
            return res.status(400).json({ mensagem: 'ID de professor e idModalidade são obrigatórios.' });
        }

        await escolaModel.associarProfessorModalidade(idProfessor, parseInt(idModalidade));

        return res.status(201).json({ mensagem: 'Modalidade associada ao professor com sucesso.' });
    } catch (error) {
        if (error.message.includes('já existe')) {
            return res.status(409).json({ mensagem: error.message });
        }
        next(error);
    }
}

// ============================================================================
// REMOVER ASSOCIAÇÃO PROFESSOR ↔ MODALIDADE (Coordenação)
// DELETE /api/escola/professores/:id/modalidades/:idModalidade
// ============================================================================
async function removerProfessorModalidade(req, res, next) {
    try {
        const idProfessor = parseInt(req.params.id);
        const idModalidade = parseInt(req.params.idModalidade);

        if (isNaN(idProfessor) || isNaN(idModalidade)) {
            return res.status(400).json({ mensagem: 'IDs inválidos.' });
        }

        const sucesso = await escolaModel.removerProfessorModalidade(idProfessor, idModalidade);

        if (!sucesso) {
            return res.status(404).json({ mensagem: 'Associação não encontrada.' });
        }

        return res.status(200).json({ mensagem: 'Associação removida com sucesso.' });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getAnosLetivos,
    getModalidades,
    getSalas,
    getCompatibilidade,
    getSalasPorModalidade,
    getProfessoresPorModalidade,
    getModalidadesPorProfessor,
    associarProfessorModalidade,
    removerProfessorModalidade
};