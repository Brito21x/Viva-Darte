const { poolPromise } = require('../config/db');
const sql = require('mssql');
 
// ============================================================================
// 1. GESTÃO DO CALENDÁRIO LETIVO
// ============================================================================
 
async function getAnosLetivos() {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT 
                id_ano_letivo, 
                ano 
            FROM ANO_LETIVO
            ORDER BY ano DESC;
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getAnosLetivos):', error);
        throw error;
    }
}
 
// ============================================================================
// 2. CATÁLOGO DE RECURSOS (SALAS E MODALIDADES)
// ============================================================================
 
async function getModalidadesAtivas() {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT 
                id_modalidade, 
                nome 
            FROM MODALIDADE 
            WHERE ativo = 1
            ORDER BY nome ASC;
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getModalidadesAtivas):', error);
        throw error;
    }
}
 
async function getSalas() {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT 
                id_sala, 
                nome, 
                capacidade_maxima 
            FROM SALA
            ORDER BY nome ASC;
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getSalas):', error);
        throw error;
    }
}
 
// ============================================================================
// 3. MATRIZES DE CRUZAMENTO (REGRAS FÍSICAS E HUMANAS)
// ============================================================================
 
/**
 * Retorna quais salas são compatíveis com cada modalidade.
 * Usado para filtrar salas disponíveis ao aprovar um coaching.
 */
async function getCompatibilidadeSalasModalidades() {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT 
                s.id_sala,
                s.nome AS nome_sala,
                s.capacidade_maxima,
                m.id_modalidade,
                m.nome AS modalidade_permitida
            FROM SALA s
            JOIN SALA_MODALIDADE sm ON s.id_sala = sm.SALAid_sala
            JOIN MODALIDADE m ON sm.MODALIDADEid_modalidade = m.id_modalidade
            WHERE m.ativo = 1
            ORDER BY s.nome ASC, m.nome ASC;
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getCompatibilidadeSalasModalidades):', error);
        throw error;
    }
}
 
/**
 * Retorna as salas compatíveis com uma modalidade específica.
 * Usado ao aprovar um pedido para apresentar apenas salas válidas para aquela modalidade.
 */
async function getSalasPorModalidade(idModalidade) {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT 
                s.id_sala,
                s.nome AS nome_sala,
                s.capacidade_maxima
            FROM SALA s
            JOIN SALA_MODALIDADE sm ON s.id_sala = sm.SALAid_sala
            WHERE sm.MODALIDADEid_modalidade = @IdModalidade
            ORDER BY s.nome ASC;
        `;
        const result = await pool.request()
            .input('IdModalidade', sql.Int, idModalidade)
            .query(query);
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getSalasPorModalidade):', error);
        throw error;
    }
}
 
/**
 * Retorna as modalidades que um professor específico leciona.
 */
async function getModalidadesPorProfessor(idProfessor) {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT 
                m.id_modalidade,
                m.nome AS modalidade
            FROM UTILIZADOR u
            JOIN PROFESSOR_MODALIDADE pm ON u.id_utilizador = pm.UTILIZADORid_utilizador
            JOIN MODALIDADE m ON pm.MODALIDADEid_modalidade = m.id_modalidade
            WHERE u.id_utilizador = @IdProfessor 
              AND u.ativo = 1 
              AND m.ativo = 1
            ORDER BY m.nome ASC;
        `;
        const result = await pool.request()
            .input('IdProfessor', sql.Int, idProfessor)
            .query(query);
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getModalidadesPorProfessor):', error);
        throw error;
    }
}
 
/**
 * Retorna os professores ativos que lecionam uma modalidade específica.
 * Usado na US05 para preencher a dropdown de professores disponíveis.
 */
async function getProfessoresPorModalidade(idModalidade) {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT 
                u.id_utilizador AS id_professor,
                u.nome AS nome_professor
            FROM MODALIDADE m
            JOIN PROFESSOR_MODALIDADE pm ON m.id_modalidade = pm.MODALIDADEid_modalidade
            JOIN UTILIZADOR u ON pm.UTILIZADORid_utilizador = u.id_utilizador
            WHERE m.id_modalidade = @IdModalidade 
              AND u.ativo = 1
            ORDER BY u.nome ASC;
        `;
        const result = await pool.request()
            .input('IdModalidade', sql.Int, idModalidade)
            .query(query);
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getProfessoresPorModalidade):', error);
        throw error;
    }
}
 
/**
 * Associa um professor a uma modalidade. (US11 / RF13)
 */
async function associarProfessorModalidade(idProfessor, idModalidade) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('IdProfessor', sql.Int, idProfessor)
            .input('IdModalidade', sql.Int, idModalidade)
            .query(`
                MERGE PROFESSOR_MODALIDADE AS t
                USING (SELECT @IdProfessor AS id_p, @IdModalidade AS id_m) AS s
                ON t.UTILIZADORid_utilizador = s.id_p AND t.MODALIDADEid_modalidade = s.id_m
                WHEN NOT MATCHED THEN
                    INSERT (UTILIZADORid_utilizador, MODALIDADEid_modalidade)
                    VALUES (s.id_p, s.id_m);
            `);

        const ra = result.rowsAffected || [];
        const totalAfetadas = (Array.isArray(ra) ? ra : [ra]).reduce(
            (acc, n) => acc + (Number(n) || 0),
            0
        );
        if (totalAfetadas < 1) {
            throw new Error('Esta associação professor/modalidade já existe.');
        }

        return true;
    } catch (error) {
        console.error('Erro no Modelo (associarProfessorModalidade):', error);
        throw error;
    }
}
 
/**
 * Remove a associação de um professor a uma modalidade.
 */
async function removerProfessorModalidade(idProfessor, idModalidade) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('IdProfessor', sql.Int, idProfessor)
            .input('IdModalidade', sql.Int, idModalidade)
            .query(`
                DELETE FROM PROFESSOR_MODALIDADE 
                WHERE UTILIZADORid_utilizador = @IdProfessor 
                  AND MODALIDADEid_modalidade = @IdModalidade;
            `);
 
        return result.rowsAffected[0] > 0;
    } catch (error) {
        console.error('Erro no Modelo (removerProfessorModalidade):', error);
        throw error;
    }
}
 
/**
 * Lista horários de aulas regulares (HORARIO), opcionalmente filtrados por ano letivo.
 */
async function getHorariosPorAnoLetivo(idAnoLetivo = null) {
    try {
        const pool = await poolPromise;
        const request = pool.request();

        let filtroAno = '';
        if (idAnoLetivo != null && !Number.isNaN(Number(idAnoLetivo))) {
            filtroAno = 'AND h.ANO_LETIVOid_ano_letivo = @IdAnoLetivo';
            request.input('IdAnoLetivo', sql.Int, parseInt(idAnoLetivo, 10));
        }

        const query = `
            SELECT 
                h.id_horario,
                h.dia_semana,
                h.hora_inicio,
                h.hora_fim,
                h.ativo,
                h.UTILIZADORid_utilizador AS id_professor,
                h.ALUNOid_aluno AS id_aluno,
                h.MODALIDADEid_modalidade AS id_modalidade,
                h.SALAid_sala AS id_sala,
                h.ANO_LETIVOid_ano_letivo AS id_ano_letivo,
                prof.nome AS nome_professor,
                al.nome AS nome_aluno,
                m.nome AS modalidade,
                s.nome AS sala
            FROM HORARIO h
            JOIN UTILIZADOR prof ON h.UTILIZADORid_utilizador = prof.id_utilizador
            JOIN ALUNO al ON h.ALUNOid_aluno = al.id_aluno
            JOIN MODALIDADE m ON h.MODALIDADEid_modalidade = m.id_modalidade
            JOIN SALA s ON h.SALAid_sala = s.id_sala
            WHERE h.ativo = 1 ${filtroAno}
            ORDER BY h.dia_semana, h.hora_inicio;
        `;

        const result = await request.query(query);
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getHorariosPorAnoLetivo):', error);
        throw error;
    }
}

module.exports = {
    getAnosLetivos,
    getModalidadesAtivas,
    getSalas,
    getCompatibilidadeSalasModalidades,
    getSalasPorModalidade,
    getModalidadesPorProfessor,
    getProfessoresPorModalidade,
    associarProfessorModalidade,
    removerProfessorModalidade,
    getHorariosPorAnoLetivo
};